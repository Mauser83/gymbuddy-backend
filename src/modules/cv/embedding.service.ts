import { Prisma, PrismaClient, prisma } from "../../lib/prisma";
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
    const whereGym =
      gymId == null ? Prisma.sql`` : Prisma.sql`AND gi."gymId" = ${gymId}`;

    const rows = await this.prisma.$queryRaw<
      { imageId: string; createdAt: Date }[]
    >(
      Prisma.sql`
        SELECT gi.id AS "imageId", emb."createdAt"
        FROM "ImageEmbedding" emb
        JOIN "GymEquipmentImage" gi ON gi.id = emb."gymImageId"
        WHERE emb."embeddingVec" IS NOT NULL
        ${whereGym}
        ORDER BY emb."createdAt" DESC
        LIMIT 1;
      `
    );
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

type Scope = 'GLOBAL' | 'GYM' | 'AUTO';

export async function getLatestEmbeddedImageService(input: {
  scope: Scope;
  gymId?: number;
  equipmentId?: number;
}) {
  const { scope, gymId, equipmentId } = input;

  if ((scope === 'GYM' || scope === 'AUTO') && !gymId) {
    throw new Error('gymId is required for this scope');
  }

  const equipFilter =
    equipmentId != null ? `AND "equipmentId" = ${Number(equipmentId)}` : '';

  if (scope === 'GLOBAL') {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
      `
      SELECT id, "createdAt"
      FROM "EquipmentImage"
      WHERE embedding IS NOT NULL
      ${equipFilter}
      ORDER BY "createdAt" DESC
      LIMIT 1
      `
    );
    const row = rows[0];
    return row
      ? { imageId: row.id, createdAt: row.createdAt, scope: 'GLOBAL' as const }
      : null;
  }

  if (scope === 'GYM') {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
      `
      SELECT id, "createdAt"
      FROM "GymEquipmentImage"
      WHERE embedding IS NOT NULL
        AND "gymId" = $1
      ${equipFilter}
      ORDER BY "createdAt" DESC
      LIMIT 1
      `,
      gymId
    );
    const row = rows[0];
    return row
      ? { imageId: row.id, createdAt: row.createdAt, scope: 'GYM' as const }
      : null;
  }

  const gymRows = await prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
    `
    SELECT id, "createdAt"
    FROM "GymEquipmentImage"
    WHERE embedding IS NOT NULL
      AND "gymId" = $1
    ${equipFilter}
    ORDER BY "createdAt" DESC
    LIMIT 1
    `,
    gymId
  );
  if (gymRows[0]) {
    return {
      imageId: gymRows[0].id,
      createdAt: gymRows[0].createdAt,
      scope: 'GYM' as const,
    };
  }

  const globalRows = await prisma.$queryRawUnsafe<
    Array<{ id: string; createdAt: Date }>
  >(
    `
    SELECT id, "createdAt"
    FROM "EquipmentImage"
    WHERE embedding IS NOT NULL
    ${equipFilter}
    ORDER BY "createdAt" DESC
    LIMIT 1
    `
  );
  const g = globalRows[0];
  return g
    ? { imageId: g.id, createdAt: g.createdAt, scope: 'GLOBAL' as const }
    : null;
}