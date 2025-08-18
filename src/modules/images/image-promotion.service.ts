import { PrismaClient } from "../../lib/prisma";
import { S3Client, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { makeKey } from "../../utils/makeKey";
import { PromoteGymImageDto } from "./images.dto";
import { AuthContext } from "../auth/auth.types";
import { verifyGymScope } from "../auth/auth.roles";
import { ImageJobStatus } from "../../generated/prisma";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

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

  async promoteGymImageToGlobal(
    input: PromoteGymImageDto,
    ctx: AuthContext
  ) {
    const gymImg = await this.prisma.gymEquipmentImage.findUniqueOrThrow({
      where: { id: input.id },
    });

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

    let splitKind: "golden" | "training" = "golden";
    if (input.splitId) {
      const split = await this.prisma.splitType.findUnique({
        where: { id: input.splitId },
        select: { key: true },
      });
      if (split?.key?.toLowerCase() === "training") splitKind = "training";
    }
    const destKey = makeKey(splitKind, { equipmentId: gymImg.equipmentId }, {});

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

    const equipmentImage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.equipmentImage.create({
        data: {
          equipmentId: gymImg.equipmentId,
          storageKey: destKey,
          sha256: gymImg.sha256 ?? null,
          mimeType: contentType,
          width: 0,
          height: 0,
          angleId: gymImg.angleId ?? null,
          heightId: gymImg.heightId ?? null,
          lightingId: gymImg.lightingId ?? null,
          mirrorId: gymImg.mirrorId ?? null,
          distanceId: gymImg.distanceId ?? null,
          sourceId: gymImg.sourceId ?? null,
          splitId: input.splitId ?? null,
        } as any,
      });

      const gymEmbeds =
        (await tx.imageEmbedding.findMany({
          where: { gymImageId: gymImg.id },
        })) ?? [];
      if (gymEmbeds.length > 0) {
        await tx.imageEmbedding.createMany({
          data: gymEmbeds.map((e) => ({
            imageId: created.id,
            scope: "GLOBAL",
            modelVendor: e.modelVendor,
            modelName: e.modelName,
            modelVersion: e.modelVersion,
            dim: e.dim,
            embeddingVec: (e as any).embeddingVec,
          })),
        });
      } else {
        await tx.imageQueue.create({
          data: {
            imageId: created.id,
            jobType: "EMBED",
            status: ImageJobStatus.pending,
            priority: 0,
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
    });

    return { equipmentImage, gymImage: gymImg, destinationKey: destKey };
  }
}