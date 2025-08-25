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
    const limit = Math.max(5, Math.min(50, input.limit ?? 10));
    let hits;
    if (input.imageId) {
      const id = input.imageId;
      const isIdNumeric = isNumeric(id);
      const numericId = isIdNumeric ? Number(id) : null;

      const seedRows = await this.prisma.$queryRaw<{ seed_gym_id: number | null }[]>`
        SELECT ie."gymId" AS seed_gym_id
        FROM "ImageEmbedding" ie
        WHERE (
              ie."gymImageId" = ${id}
          OR (${isIdNumeric} AND ie."imageId" = ${numericId})
        )
          AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
          AND ie."modelName"   = ${ACTIVE_MODEL.name}
          AND ie."modelVersion"= ${ACTIVE_MODEL.version}
        ORDER BY ie."createdAt" DESC
        LIMIT 1
      `;
      if (!seedRows.length) throw new Error(`No embedding found for imageId "${id}".`);
      const seedGymId = seedRows[0].seed_gym_id;

      if (input.scope === "GLOBAL") {
        hits = await this.prisma.$queryRaw<
          { image_id: string; equipment_id: number; score: number; storage_key: string }[]
        >`
          WITH seed AS (
            SELECT ie."embeddingVec" AS qvec
            FROM "ImageEmbedding" ie
            WHERE (
                  ie."gymImageId" = ${id}
              OR (${isIdNumeric} AND ie."imageId" = ${numericId})
            )
              AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
              AND ie."modelName"   = ${ACTIVE_MODEL.name}
              AND ie."modelVersion"= ${ACTIVE_MODEL.version}
            ORDER BY ie."createdAt" DESC
            LIMIT 1
          )
          SELECT
            ei.id AS image_id,
            ei."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> seed.qvec) AS score,
            ei."storageKey" AS storage_key
          FROM seed
          JOIN "ImageEmbedding" ie
            ON ie."scope_type" = 'GLOBAL'
           AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
           AND ie."modelName"   = ${ACTIVE_MODEL.name}
           AND ie."modelVersion"= ${ACTIVE_MODEL.version}
          JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
          ORDER BY ie."embeddingVec" <=> seed.qvec
          LIMIT ${limit}
        `;
      } else {
        if (seedGymId == null) {
          throw new Error("Seed image must belong to a gym for GYM scope search");
        }
        hits = await this.prisma.$queryRaw<
          { image_id: string; equipment_id: number; score: number; storage_key: string }[]
        >`
          WITH seed AS (
            SELECT ie."embeddingVec" AS qvec
            FROM "ImageEmbedding" ie
            WHERE (
                  ie."gymImageId" = ${id}
              OR (${isIdNumeric} AND ie."imageId" = ${numericId})
            )
              AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
              AND ie."modelName"   = ${ACTIVE_MODEL.name}
              AND ie."modelVersion"= ${ACTIVE_MODEL.version}
            ORDER BY ie."createdAt" DESC
            LIMIT 1
          )
          SELECT
            gi.id AS image_id,
            gi."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> seed.qvec) AS score,
            gi."storageKey" AS storage_key
          FROM seed
          JOIN "ImageEmbedding" ie
            ON ie."scope_type" = 'GYM'
           AND ie."gym_id" = ${seedGymId}
           AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
           AND ie."modelName"   = ${ACTIVE_MODEL.name}
           AND ie."modelVersion"= ${ACTIVE_MODEL.version}
          JOIN "GymEquipmentImage" gi ON gi.id = ie."gymImageId"
          ORDER BY ie."embeddingVec" <=> seed.qvec
          LIMIT ${limit}
        `;
      }
    } else if (input.vector) {
      const vectorParam = `[${input.vector
        .map((v) => (Number.isFinite(v) ? v : 0))
        .join(",")}]`;
      if (input.scope === "GLOBAL") {
        hits = await this.prisma.$queryRaw<
          { image_id: string; equipment_id: number; score: number; storage_key: string }[]
        >`
          SELECT
            ei.id AS image_id,
            ei."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> ${vectorParam}::vector) AS score,
            ei."storageKey" AS storage_key
          FROM "ImageEmbedding" ie
          JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
          WHERE ie."scope_type" = 'GLOBAL'
            AND ie."modelVendor" = ${ACTIVE_MODEL.vendor}
            AND ie."modelName"   = ${ACTIVE_MODEL.name}
            AND ie."modelVersion"= ${ACTIVE_MODEL.version}
          ORDER BY ie."embeddingVec" <=> ${vectorParam}::vector
          LIMIT ${limit}
        `;
      } else {
        throw new Error("Seed image must belong to a gym for GYM scope search");
      }
    } else {
      throw new Error("Provide either imageId or vector.");
    }
    return hits.map((h: any) => ({
      imageId: h.image_id,
      equipmentId: h.equipment_id,
      score: h.score,
      storageKey: h.storage_key,
    }));
  }
}