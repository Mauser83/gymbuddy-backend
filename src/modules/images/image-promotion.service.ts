import { PrismaClient, Prisma } from "../../lib/prisma";
import type { Prisma as PrismaTypes } from "../../generated/prisma";
import { S3Client, CopyObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { fileExtFrom } from "../../utils/makeKey";
import { randomUUID } from "crypto";
import {
  PromoteGymImageDto,
  ApproveTrainingCandidateDto,
  RejectTrainingCandidateDto,
  ListTrainingCandidatesDto,
} from "./images.dto";
import { AuthContext } from "../auth/auth.types";
import { verifyGymScope } from "../auth/auth.roles";
import { ImageJobStatus } from "../../generated/prisma";
import sharp from "sharp";
import { kickBurstRunner } from "./image-worker";
import { writeImageEmbedding } from "../cv/embeddingWriter";

const EMBED_VENDOR = process.env.EMBED_VENDOR || "local";
const EMBED_MODEL = process.env.EMBED_MODEL || "mobileCLIP-S0";
const EMBED_VERSION = process.env.EMBED_VERSION || "1.0";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

// helper: parse pgvector text like "[0.12, -0.34, 0.56]" → number[]
function parsePgvectorText(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const s = v.trim();
  if (s.length < 2 || s[0] !== '[' || s[s.length - 1] !== ']') return null;
  const parts = s.slice(1, -1).split(',');
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export class ImagePromotionService {
  constructor(private readonly prisma: PrismaClient) {}

  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private async getImageMeta(key: string, fallbackMime: string) {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const body: any = res.Body;
    let bytes: Uint8Array;
    if (typeof body?.transformToByteArray === "function") {
      bytes = await body.transformToByteArray();
    } else {
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.length;
      }
    }
    const meta = await sharp(bytes).metadata();
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      mime: meta.format ? `image/${meta.format}` : fallbackMime,
    };
  }

  async promoteGymImageToGlobal(
    input: PromoteGymImageDto,
    ctx: AuthContext
  ) {
    const gymImg = (await this.prisma.gymEquipmentImage.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        gymId: true,
        equipmentId: true,
        storageKey: true,
        sha256: true,
        angleId: true,
        heightId: true,
        lightingId: true,
        mirrorId: true,
        distanceId: true,
        sourceId: true,
        splitId: true,
        capturedByUserId: true,
        approvedByUserId: true,
        hasPerson: true,
        personCount: true,
        personBoxes: true,
        status: true,
        isSafe: true,
        // embedding intentionally omitted; fetched via raw query
        modelVendor: true,
        modelName: true,
        modelVersion: true,
      },
    } as any)) as any;

    if (!gymImg) throw new Error("Gym image not found");

    if (ctx.appRole !== "ADMIN") {
      verifyGymScope(ctx, ctx.permissionService, gymImg.gymId);
    }
    if (input.force && ctx.appRole !== "ADMIN") {
      throw new Error("force requires admin role");
    }

    if (!input.force) {
      if (gymImg.status !== "APPROVED") {
        throw new Error("Image must be APPROVED before promotion");
      }
      if (gymImg.isSafe !== true) {
        throw new Error("Image failed safety checks");
      }
    }

    if (!gymImg.equipmentId || !gymImg.storageKey) {
      throw new Error("Gym image missing equipmentId/storageKey");
    }

    const splitId = input.splitId ?? gymImg.splitId ?? null;
    const ext = fileExtFrom(gymImg.storageKey);
    const destKey = `private/global/equipment/${gymImg.equipmentId}/approved/${
      gymImg.sha256 ?? randomUUID()
    }.${ext}`;
    
    if (gymImg.sha256) {
      const existing = await this.prisma.equipmentImage.findFirst({
        where: { equipmentId: gymImg.equipmentId, sha256: gymImg.sha256 },
      });
      if (existing) {
        if (gymImg.status !== "APPROVED") {
          await this.prisma.gymEquipmentImage.update({
            where: { id: gymImg.id },
            data: { status: "APPROVED" },
          });
          gymImg.status = "APPROVED";
        }
        return { equipmentImage: existing, gymImage: gymImg, destinationKey: existing.storageKey };
      }
    }

    const head = await this.s3
      .send(new HeadObjectCommand({ Bucket: BUCKET, Key: gymImg.storageKey }))
      .catch((err) => {
        if (err?.$metadata?.httpStatusCode === 404)
          throw new Error("Source object not found");
        throw err;
      });
    const contentType = head.ContentType || "image/jpeg";

    await this.s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${gymImg.storageKey}`,
        Key: destKey,
        MetadataDirective: "COPY",
        ACL: "private",
      })
    );

    const meta = await this.getImageMeta(destKey, contentType);

    const equipmentImage = await this.prisma.$transaction(async (tx) => {
      const data = {
        equipmentId: gymImg.equipmentId,
        uploadedByUserId:
          gymImg.capturedByUserId ??
          gymImg.approvedByUserId ??
          ctx.userId ??
          null,
        storageKey: destKey,
        mimeType: meta.mime,
        width: meta.width,
        height: meta.height,
        sha256: gymImg.sha256 ?? null,
        angleId: gymImg.angleId ?? null,
        heightId: gymImg.heightId ?? null,
        lightingId: gymImg.lightingId ?? null,
        mirrorId: gymImg.mirrorId ?? null,
        distanceId: gymImg.distanceId ?? null,
        sourceId: gymImg.sourceId ?? null,
        splitId: splitId,
        hasPerson: gymImg.hasPerson ?? null,
        personCount: gymImg.personCount ?? null,
        personBoxes: gymImg.personBoxes ?? null,
        modelVendor: gymImg.modelVendor ?? EMBED_VENDOR,
        modelName: gymImg.modelName ?? EMBED_MODEL,
        modelVersion: gymImg.modelVersion ?? EMBED_VERSION,
      } as any;

      try {
        const [row] = await tx.$queryRaw<{ embedding_text: string }[]>`
          SELECT embedding::text AS embedding_text
          FROM "GymEquipmentImage"
          WHERE id = ${gymImg.id}
          LIMIT 1
        `;
        const gymEmbeddingText = row?.embedding_text ?? null;
        const created = await tx.equipmentImage.create({ data });
        if (gymEmbeddingText) {
          await tx.$executeRaw`
            UPDATE "EquipmentImage"
            SET embedding      = CAST(${gymEmbeddingText} AS vector),
                "modelVendor"  = COALESCE("modelVendor",  ${EMBED_VENDOR}),
                "modelName"    = COALESCE("modelName",    ${EMBED_MODEL}),
                "modelVersion" = COALESCE("modelVersion", ${EMBED_VERSION})
            WHERE id = ${created.id}
          `;
        } else {
          await tx.imageQueue.create({
            data: {
              imageId: created.id,
              jobType: "EMBED",
              status: ImageJobStatus.pending,
              priority: 0,
              storageKey: null,
            },
          });
        }

        if (gymImg.status !== "APPROVED") {
          await tx.gymEquipmentImage.update({
            where: { id: gymImg.id },
            data: { status: "APPROVED" },
          });
          gymImg.status = "APPROVED";
        }

        return created;
      } catch (e: any) {
        console.error('EquipmentImage.create failed (raw)', {
          name: e?.name,
          code: e?.code,
          message: e?.message,
          meta: e?.meta,
        });
        throw e;
      }
    });

    setImmediate(() => {
      kickBurstRunner().catch((e) =>
        console.error("burst runner error", e)
      );
    });

    return { equipmentImage, gymImage: gymImg, destinationKey: destKey };
  }

async listTrainingCandidates(
    input: ListTrainingCandidatesDto,
    ctx: AuthContext
  ) {
    verifyGymScope(ctx, ctx.permissionService, input.gymId);

    const where: any = {
      gymId: input.gymId,
      status: (input.status ?? "PENDING").toLowerCase(),
    };

    if (input.equipmentId) {
      where.gymEquipment = { equipmentId: input.equipmentId };
    }

    if (input.q) {
      where.gymEquipment = {
        ...(where.gymEquipment || {}),
        equipment: {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { brand: { contains: input.q, mode: "insensitive" } },
          ],
        },
      };
    }

    const limit = Math.min(input.limit ?? 50, 100);

    let cursorFilter: any = {};
    if (input.cursor) {
      const [id, createdAt] = Buffer.from(input.cursor, "base64")
        .toString("utf8")
        .split("|");
      cursorFilter = {
        OR: [
          { createdAt: { lt: new Date(createdAt) } },
          { createdAt: new Date(createdAt), id: { lt: id } },
        ],
      };
    }

    const rows = await this.prisma.trainingCandidate.findMany({
      where: { ...where, ...cursorFilter },
      include: {
        gymEquipment: { include: { equipment: true } },
        uploader: { select: { id: true, username: true } },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = rows.pop()!;
      nextCursor = Buffer.from(
        `${last.id}|${last.createdAt.toISOString()}`
      ).toString("base64");
    }

    return {
      items: rows.map(r => ({
        id: r.id,
        gymId: r.gymId!,
        gymEquipmentId: r.gymEquipmentId!,
        equipmentId: r.gymEquipment?.equipmentId!,
        equipmentName: r.gymEquipment?.equipment?.name ?? null,
        storageKey: r.storageKey,
        status: r.status.toUpperCase(),
        safetyReasons: r.safetyReasons,
        capturedAt: r.capturedAt?.toISOString() ?? null,
        uploader: r.uploader,
        hash: r.hash,
        processedAt: r.processedAt?.toISOString() ?? null,
      })),
      nextCursor,
    };
  }

  async approveTrainingCandidate(
    input: ApproveTrainingCandidateDto,
    ctx: AuthContext
  ) {
    const cand = await this.prisma.trainingCandidate.findUniqueOrThrow({
      where: { id: input.id },
      select: {
        id: true,
        gymId: true,
        gymEquipmentId: true,
        storageKey: true,
        hash: true,
        status: true,
        capturedAt: true,
        uploaderUserId: true,
        recognitionScoreAtCapture: true,
        isSafe: true,
        nsfwScore: true,
        hasPerson: true,
        personCount: true,
        personBoxes: true,
        safetyReasons: true,
        embeddingModelVendor: true,
        embeddingModelName: true,
        embeddingModelVersion: true,
      },
    });

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ embedding_text: string }>
    >(
      `SELECT embedding::text AS embedding_text FROM "TrainingCandidate" WHERE id = $1`,
      input.id
    );
    const candidateVector = parsePgvectorText(rows?.[0]?.embedding_text);

    if (cand.gymId == null || cand.gymEquipmentId == null) {
      throw new Error("Candidate missing required fields");
    }
    if (cand.status === "quarantined") {
      throw new Error("Cannot approve quarantined image");
    }
    if (!cand.hash || !cand.storageKey) {
      throw new Error("Candidate not processed yet");
    }    
    const gymId = cand.gymId;
    const gymEquipmentId = cand.gymEquipmentId;
    verifyGymScope(ctx, ctx.permissionService, gymId);
    const ext =
      cand.storageKey.split(".").pop()?.toLowerCase() || "jpg";
    const approvedKey = `private/gym/${gymEquipmentId}/approved/${cand.hash}.${ext}`;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gymEquipmentImage.findFirst({
        where: { storageKey: approvedKey },
        select: { id: true },
      });
      if (existing) {
        await tx.trainingCandidate.update({
          where: { id: cand.id },
          data: { status: "approved", imageId: existing.id },
        });
        return { approved: true, imageId: existing.id, storageKey: approvedKey };
      }
      const gymEq = await tx.gymEquipment.findUniqueOrThrow({
        where: { id: gymEquipmentId },
        select: { equipmentId: true },
      });

      try {
        await this.s3.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${cand.storageKey}`,
            Key: approvedKey,
            MetadataDirective: "COPY",
            ACL: "private",
          })
        );
      } catch (err) {
        console.error("Copy to approved key failed", err);
        throw new Error("Failed to copy candidate image");
      }

      const img = await tx.gymEquipmentImage.create({
        data: {
          gymId,
          gymEquipmentId,
          equipmentId: gymEq.equipmentId,
          storageKey: approvedKey,
          status: "APPROVED",
          approvedAt: new Date(),
          approvedByUserId: ctx.userId ?? null,
          sha256: cand.hash,
          capturedAt: cand.capturedAt ?? new Date(),
          capturedByUserId: cand.uploaderUserId ?? null,
          recognitionScoreAtCapture: cand.recognitionScoreAtCapture ?? null,
          isSafe: cand.isSafe ?? null,
          nsfwScore: cand.nsfwScore ?? null,
          hasPerson: cand.hasPerson ?? null,
          personCount: cand.personCount ?? null,
          personBoxes: cand.personBoxes
            ? (cand.personBoxes as PrismaTypes.InputJsonValue)
            : Prisma.DbNull,
          safetyReasons: cand.safetyReasons ?? [],
          modelVendor: cand.embeddingModelVendor ?? null,
          modelName: cand.embeddingModelName ?? null,
          modelVersion: cand.embeddingModelVersion ?? null,
        },
        select: { id: true },
      });

      if (candidateVector && candidateVector.length > 0) {
        await writeImageEmbedding({
          target: "GYM",
          imageId: img.id,
          gymId,
          vector: candidateVector,
          modelVendor: EMBED_VENDOR,
          modelName: EMBED_MODEL,
          modelVersion: EMBED_VERSION,
        });
      }

      await tx.trainingCandidate.update({
        where: { id: cand.id },
        data: { status: "approved", imageId: img.id },
      });

      return { approved: true, imageId: img.id, storageKey: approvedKey };
    });
  }

  async rejectTrainingCandidate(input: RejectTrainingCandidateDto, ctx: AuthContext) {
    const cand = await this.prisma.trainingCandidate.findUniqueOrThrow({
      where: { id: input.id },
      select: { id: true, gymId: true },
    });
    if (cand.gymId) verifyGymScope(ctx, ctx.permissionService, cand.gymId);

    await this.prisma.trainingCandidate.update({
      where: { id: cand.id },
      data: { status: 'rejected', rejectionReason: input.reason ?? null },
    });

    return { rejected: true };
  }
}