import { PrismaClient } from "../../lib/prisma";

export type KnnSearchInput = {
  imageId?: string;
  vector?: number[];
  scope: string;
  limit?: number;
};

const MODEL_VENDOR = process.env.EMBED_VENDOR ?? "local";
const MODEL_NAME = process.env.EMBED_MODEL ?? "mobileCLIP-S0";
const MODEL_VERSION = process.env.EMBED_VERSION ?? "1.0";
const ACTIVE_MODEL = { vendor: MODEL_VENDOR, name: MODEL_NAME, version: MODEL_VERSION };
const isNumeric = (v: string) => /^\d+$/.test(v);

export class KnnService {
  constructor(private prisma: PrismaClient) {}

  async knnSearch(input: KnnSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);

    // Materialize query vector
    let queryVec: number[];
    let seedGymId: number | null = null;
    if (input.imageId) {
      let seed = await this.prisma.imageEmbedding.findFirst({
        where: {
          gymImageId: input.imageId,
          modelVendor: ACTIVE_MODEL.vendor,
          modelName: ACTIVE_MODEL.name,
          modelVersion: ACTIVE_MODEL.version,
        },
        select: { id: true, dim: true, scopeType: true, gymId: true, scope: true },
      });
      if (!seed && isNumeric(input.imageId)) {
        seed = await this.prisma.imageEmbedding.findFirst({
          where: {
            imageId: input.imageId,
            modelVendor: ACTIVE_MODEL.vendor,
            modelName: ACTIVE_MODEL.name,
            modelVersion: ACTIVE_MODEL.version,
          },
          select: { id: true, dim: true, scopeType: true, gymId: true, scope: true },
        });
      }
      if (!seed) throw new Error(`No embedding found for imageId "${input.imageId}".`);

      const vecRow = await this.prisma.$queryRawUnsafe<{ embedding_vec: any }[]>(
        `SELECT "embeddingVec" AS embedding_vec FROM "ImageEmbedding" WHERE id = $1 LIMIT 1`,
        seed.id,
      );
      if (!vecRow.length) throw new Error("Embedding vector not found");
      queryVec = Array.isArray(vecRow[0].embedding_vec)
        ? vecRow[0].embedding_vec
        : JSON.parse(vecRow[0].embedding_vec);

      if (queryVec.length !== seed.dim) {
        throw new Error(`Vector dimension mismatch: expected ${seed.dim}, got ${queryVec.length}`);
      }
      seedGymId =
        seed.gymId ??
        (seed.scopeType == null && seed.scope?.startsWith("GYM:")
          ? parseInt(seed.scope.split(":")[1])
          : null);
    } else if (input.vector) {
      queryVec = input.vector;
    } else {
      throw new Error("Provide either imageId or vector.");
    }

    const vectorParam = `[${queryVec.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;

    // Choose join target by scope
    let hits;
    if (input.scope === "GLOBAL") {
      hits = await this.prisma.$queryRaw<
        { image_id: string; equipment_id: number; score: number; storage_key: string }[]
      >`
        SELECT
          ei.id AS image_id,
          ei."equipmentId" AS equipment_id,
          (1.0 - (ie."embeddingVec" <=> ${vectorParam}::vector)) AS score,
          ei."storageKey" AS storage_key
        FROM "ImageEmbedding" ie
        JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
        WHERE (
            ie."scope_type" = 'GLOBAL'
            OR (ie."scope_type" IS NULL AND ie."scope" = 'GLOBAL')
          )
          AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
          AND ie."modelName" = ${ACTIVE_MODEL.name}
          AND ie."modelVersion" = ${ACTIVE_MODEL.version}
        ORDER BY ie."embeddingVec" <=> ${vectorParam}::vector
        LIMIT ${limit}
      `;
    } else {
      if (seedGymId == null) {
        throw new Error("Seed image must belong to a gym for GYM scope search");
      }
      hits = await this.prisma.$queryRaw<
        { image_id: string; equipment_id: number; score: number; storage_key: string }[]
      >`
        SELECT
          gi.id AS image_id,
          gi."equipmentId" AS equipment_id,
          (1.0 - (ie."embeddingVec" <=> ${vectorParam}::vector)) AS score,
          gi."storageKey" AS storage_key
        FROM "ImageEmbedding" ie
        JOIN "GymEquipmentImage" gi ON gi.id = ie."gymImageId"
        WHERE (
            (ie."scope_type" = 'GYM' AND ie."gym_id" = ${seedGymId})
            OR (ie."scope_type" IS NULL AND ie."scope" = ${`GYM:${seedGymId}`})
          )
          AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
          AND ie."modelName" = ${ACTIVE_MODEL.name}
          AND ie."modelVersion" = ${ACTIVE_MODEL.version}
        ORDER BY ie."embeddingVec" <=> ${vectorParam}::vector
        LIMIT ${limit}
      `;
    }
    return hits.map((h: any) => ({
      imageId: h.image_id,
      equipmentId: h.equipment_id,
      score: h.score,
      storageKey: h.storage_key,
    }));
  }
}