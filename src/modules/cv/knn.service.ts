import { PrismaClient } from "../../lib/prisma";

export type KnnSearchInput = {
  imageId?: string;
  vector?: number[];
  scope: string;
  limit?: number;
};

const ACTIVE_MODEL = { vendor: "openai", name: "mobileclip-s0", version: "fp32" };

export class KnnService {
  constructor(private prisma: PrismaClient) {}

  async knnSearch(input: KnnSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

    // Materialize query vector
    let queryVec: number[];
    if (input.imageId) {
      const row = await this.prisma.imageEmbedding.findFirstOrThrow({
        where: {
          imageId: input.imageId,
          scope: input.scope,
          modelVendor: ACTIVE_MODEL.vendor,
          modelName: ACTIVE_MODEL.name,
          modelVersion: ACTIVE_MODEL.version,
        },
        select: { dim: true },
      });
      const result = await this.prisma.$queryRawUnsafe<{ embedding_vec: any }[]>(
        `SELECT "embeddingVec" AS embedding_vec FROM "ImageEmbedding"
         WHERE "imageId"=$1 AND scope=$2 AND "modelVendor"=$3 AND "modelName"=$4 AND "modelVersion"=$5
         LIMIT 1`,
        input.imageId,
        input.scope,
        ACTIVE_MODEL.vendor,
        ACTIVE_MODEL.name,
        ACTIVE_MODEL.version,
      );
      if (!result.length) throw new Error("Embedding vector not found");
      queryVec = Array.isArray(result[0].embedding_vec)
        ? result[0].embedding_vec
        : JSON.parse(result[0].embedding_vec);
      if (queryVec.length !== row.dim) {
        throw new Error(`Vector dimension mismatch: expected ${row.dim}, got ${queryVec.length}`);
      }
    } else if (input.vector) {
      queryVec = input.vector;
    } else {
      throw new Error("Provide either imageId or vector.");
    }

    // Dimension guard using any existing embedding metadata
    const meta = await this.prisma.imageEmbedding.findFirst({
      where: {
        scope: input.scope,
        modelVendor: ACTIVE_MODEL.vendor,
        modelName: ACTIVE_MODEL.name,
        modelVersion: ACTIVE_MODEL.version,
      },
      select: { dim: true },
    });
    if (meta && queryVec.length !== meta.dim) {
      throw new Error(`Vector dimension mismatch: expected ${meta.dim}, got ${queryVec.length}`);
    }

    const vectorParam = `[${queryVec.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;

    const hits = await this.prisma.$queryRaw<
      { image_id: string; equipment_id: number; score: number; storage_key: string }[]
    >`
      SELECT
        ei.id AS image_id,
        ei."equipmentId" AS equipment_id,
        (1.0 - (ie."embeddingVec" <=> ${vectorParam}::vector)) AS score,
        ei."storageKey" AS storage_key
      FROM "ImageEmbedding" ie
      JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
      WHERE ie.scope = ${input.scope}
        AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
        AND ie."modelName" = ${ACTIVE_MODEL.name}
        AND ie."modelVersion" = ${ACTIVE_MODEL.version}
      ORDER BY ie."embeddingVec" <=> ${vectorParam}::vector
      LIMIT ${limit}
    `;

    return hits.map((h) => ({
      imageId: h.image_id,
      equipmentId: h.equipment_id,
      score: h.score,
      storageKey: h.storage_key,
    }));
  }
}