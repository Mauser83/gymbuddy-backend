import { PrismaClient } from "../../lib/prisma";
import {
  GetImageEmbeddingsByImageDto,
  UpsertImageEmbeddingDto,
} from "./embedding.dto";
import { validateInput } from "../../middlewares/validation";

export class EmbeddingService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listByImage(imageId: string, scope?: string) {
    await validateInput({ imageId, scope }, GetImageEmbeddingsByImageDto);
    return this.prisma.imageEmbedding.findMany({
      where: { imageId, ...(scope ? { scope } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  getById(id: string) {
    return this.prisma.imageEmbedding.findUnique({
      where: { id },
    });
  }

    async getLatestEmbeddedImage(gymId?: number) {
    const gymParam = gymId ?? null;
    const rows = await this.prisma.$queryRaw<
      { imageId: string; createdAt: Date }[]
    >`
      SELECT gi.id AS "imageId", emb."createdAt"
      FROM "ImageEmbedding" emb
      JOIN "GymEquipmentImage" gi ON gi.id = emb."gymImageId"
      WHERE emb."embeddingVec" IS NOT NULL
        AND (${gymParam} IS NULL OR gi."gymId" = ${gymParam})
      ORDER BY emb."createdAt" DESC
      LIMIT 1;
    `;
    return rows[0] ?? null;
  }

  async upsert(input: UpsertImageEmbeddingDto, vector?: number[]) {
    await validateInput(input, UpsertImageEmbeddingDto);
    const whereUnique = {
      imageId_scope_modelVendor_modelName_modelVersion: {
        imageId: input.imageId,
        scope: input.scope,
        modelVendor: input.modelVendor,
        modelName: input.modelName,
        modelVersion: input.modelVersion,
      },
    };

    await this.prisma.$executeRaw`
      INSERT INTO "ImageEmbedding" ("imageId","scope","modelVendor","modelName","modelVersion","dim")
      VALUES (${input.imageId},${input.scope},${input.modelVendor},${input.modelName},${input.modelVersion},${input.dim})
      ON CONFLICT ("imageId","scope","modelVendor","modelName","modelVersion")
      DO UPDATE SET "dim" = EXCLUDED."dim";
    `;

    const record = await this.prisma.imageEmbedding.findUnique({ where: whereUnique });

    // Vector persistence via raw SQL if needed
    if (vector && record) {
      // await this.prisma.$executeRawUnsafe(
      //   `update "ImageEmbedding" set "embeddingVec" = $1 where id = $2`,
      //   vector,
      //   record.id,
      // );
    }

    return record;
  }

  async delete(id: string) {
    await this.prisma.imageEmbedding.delete({ where: { id } });
    return true;
  }
}