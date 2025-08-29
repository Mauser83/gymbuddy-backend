import { PrismaClient } from "../../lib/prisma";
import { S3Client, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { ApproveGymImageDto, RejectGymImageDto, CandidateGlobalImagesDto } from "./images.dto";
import { AuthContext } from "../auth/auth.types";
import { verifyGymScope } from "../auth/auth.roles";
import { makeGymApprovedKey, fileExtFrom } from "../../utils/makeKey";
import { ImageJobStatus } from "../../generated/prisma";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

export class ImageModerationService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private assertModerationPermission(ctx: AuthContext, gymId: number) {
    if (ctx.appRole !== "ADMIN") {
      verifyGymScope(ctx, ctx.permissionService, gymId);
    }
  }

  private guardSafetyUnlessForce(img: { isSafe: boolean | null | undefined }, force?: boolean) {
    if (!force && img.isSafe !== true) {
      throw new Error("Image failed safety checks");
    }
  }

  async approveGymImage(input: ApproveGymImageDto, ctx: AuthContext) {
    const gymImg = await this.prisma.gymEquipmentImage.findUniqueOrThrow({
      where: { id: input.id },
      select: {
        id: true,
        gymId: true,
        storageKey: true,
        status: true,
        isSafe: true,
      },
    });
    this.assertModerationPermission(ctx, gymImg.gymId);
    this.guardSafetyUnlessForce(gymImg, input.force);

    const embedRows = await this.prisma.$queryRaw<{ has: boolean }[]>`
      SELECT embedding IS NOT NULL AS has FROM "GymEquipmentImage" WHERE id = ${input.id}`;
    const hasEmbedding = embedRows?.[0]?.has ?? false;

    if (!gymImg.storageKey) throw new Error("Gym image missing storageKey");
    const ext = fileExtFrom(gymImg.storageKey);
    const dstKey = makeGymApprovedKey(gymImg.gymId, ext);

    await this.s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${gymImg.storageKey}`,
        Key: dstKey,
        MetadataDirective: "COPY",
        ACL: "private",
      })
    );

    const updated = await this.prisma.gymEquipmentImage.update({
      where: { id: gymImg.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: ctx.userId ?? null,
        storageKey: dstKey,
      },
    });

    if (!hasEmbedding) {
      await this.prisma.imageQueue.create({
        data: {
          jobType: "EMBED",
          status: ImageJobStatus.pending,
          priority: 0,
          storageKey: dstKey,
        },
      });
    }

    return { gymImage: updated };
  }

  async rejectGymImage(input: RejectGymImageDto, ctx: AuthContext) {
    const gymImg = await this.prisma.gymEquipmentImage.findUniqueOrThrow({
      where: { id: input.id },
    });
    this.assertModerationPermission(ctx, gymImg.gymId);
    const updated = await this.prisma.gymEquipmentImage.update({
      where: { id: input.id },
      data: { status: "REJECTED" },
    });
    if (input.deleteObject && updated.storageKey) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: updated.storageKey }));
    }
    return { gymImage: updated };
  }

async candidateGlobalImages(input: CandidateGlobalImagesDto) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);

    const where: any = {
      equipmentId: input.equipmentId,
      status: { in: ["PENDING", "APPROVED"] },
    };
    if (input.gymId != null) where.gymId = input.gymId;

    if (input.status) {
      where.status = input.status;
    }

    if (input.safety?.state) {
      if (input.safety.state === "COMPLETE") where.isSafe = true;
      else if (input.safety.state === "FAILED") where.isSafe = false;
      else where.isSafe = null;
    }

    if (input.search) {
      const s = String(input.search).trim();
      where.OR = [{ id: s }, { sha256: { startsWith: s } }];
    }

    const existing = await this.prisma.equipmentImage.findMany({
      where: { equipmentId: input.equipmentId },
      select: { sha256: true },
    });
    const existingSet = new Set(existing.map((e) => e.sha256).filter(Boolean));

    const candidates = await this.prisma.gymEquipmentImage.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      skip: offset,
      take: limit * 2,
      select: {
        id: true,
        gymId: true,
        equipmentId: true,
        storageKey: true,
        sha256: true,
        status: true,
        capturedAt: true,
        angleId: true,
        heightId: true,
        distanceId: true,
        lightingId: true,
        mirrorId: true,
        splitId: true,
        sourceId: true,
        isSafe: true,
      },
    });

    const filtered = candidates
      .filter((c) => c.sha256 == null || !existingSet.has(c.sha256))
      .slice(0, limit);

    const gymIds = [...new Set(filtered.map((r) => r.gymId))];
    const gyms = gymIds.length
      ? await this.prisma.gym.findMany({
          where: { id: { in: gymIds } },
          select: { id: true, name: true },
        })
      : [];
    const gymNameById = new Map(gyms.map((g) => [g.id, g.name]));

    const sha256s = [...new Set(filtered.map((r) => r.sha256).filter(Boolean) as string[])];
    const dupTotals = await this.computeDupTotalsAcrossGymAndGlobal(sha256s);

    return filtered.map((r) => ({
      id: r.id,
      gymId: r.gymId,
      equipmentId: r.equipmentId,
      storageKey: r.storageKey,
      sha256: r.sha256,
      status: r.status,
      createdAt: r.capturedAt.toISOString?.() ?? String(r.capturedAt),
      gymName: gymNameById.get(r.gymId) ?? String(r.gymId),
      tags: {
        angleId: r.angleId,
        heightId: r.heightId,
        distanceId: r.distanceId,
        lightingId: r.lightingId,
        mirrorId: r.mirrorId,
        splitId: r.splitId,
        sourceId: r.sourceId,
      },
      safety: {
        state: r.isSafe === true ? "COMPLETE" : r.isSafe === false ? "FAILED" : "PENDING",
        score: null,
        reasons: [],
      },
      dupCount: Math.max((dupTotals.get(r.sha256 ?? "") ?? 1) - 1, 0),
    }));
  }

  private async computeDupTotalsAcrossGymAndGlobal(sha256s: string[]) {
    if (sha256s.length === 0) return new Map<string, number>();

    const [gym, equip] = await Promise.all([
      this.prisma.gymEquipmentImage.groupBy({
        by: ["sha256"],
        where: { sha256: { in: sha256s } },
        _count: { sha256: true },
      }),
      this.prisma.equipmentImage.groupBy({
        by: ["sha256"],
        where: { sha256: { in: sha256s } },
        _count: { sha256: true },
      }),
    ]);

    const map = new Map<string, number>();
    for (const g of gym) map.set(g.sha256!, (map.get(g.sha256!) ?? 0) + (g._count.sha256 ?? 0));
    for (const e of equip) map.set(e.sha256!, (map.get(e.sha256!) ?? 0) + (e._count.sha256 ?? 0));
    return map;
  }
}