import { PrismaClient } from "../../lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ApproveGymImageDto, RejectGymImageDto, CandidateGlobalImagesDto } from "./images.dto";
import { AuthContext } from "../auth/auth.types";
import { verifyGymScope } from "../auth/auth.roles";
import { ImagePromotionService } from "./image-promotion.service";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

export class ImageModerationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly promotion: ImagePromotionService,
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
    });
    this.assertModerationPermission(ctx, gymImg.gymId);
    this.guardSafetyUnlessForce(gymImg, input.force);
    const updated =
      gymImg.status !== "APPROVED"
        ? await this.prisma.gymEquipmentImage.update({
            where: { id: input.id },
            data: { status: "APPROVED" },
          })
        : gymImg;
    const promoted = await this.promotion.promoteGymImageToGlobal(
      { id: input.id, splitId: input.splitId, force: input.force },
      ctx,
    );
    return promoted ?? { gymImage: updated };
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
    return this.prisma.$queryRaw<any[]>`
      SELECT g.id, g."gymId", g."equipmentId", g."storageKey", g.sha256, g.status
      FROM "GymEquipmentImage" g
      WHERE g."equipmentId" = ${input.equipmentId}
        AND (g.status IN ('PENDING','APPROVED'))
        AND (
          g.sha256 IS NULL OR NOT EXISTS (
            SELECT 1 FROM "EquipmentImage" e
            WHERE e."equipmentId" = g."equipmentId" AND e.sha256 = g.sha256
          )
        )
      ORDER BY g."capturedAt" DESC
      LIMIT ${limit}
    `;
  }
}