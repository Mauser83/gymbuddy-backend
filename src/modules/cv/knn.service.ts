import { PrismaClient } from "../../lib/prisma";

export type KnnSearchInput = {
  imageId?: string;
  vector?: number[];
  scope: string;
  limit?: number;
};

type RawKnnHit = {
  image_id: string;
  equipment_id: number | null;
  score: number;
  storage_key: string | null;
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
    let hits: RawKnnHit[];
    if (input.imageId) {
      const seed = await this.prisma.imageEmbedding.findFirst({
        where: {
          OR: [
            { gymImageId: input.imageId },
            ...(isNumeric(input.imageId) ? [{ imageId: input.imageId }] : []),
          ],
          modelVendor: ACTIVE_MODEL.vendor,
          modelName: ACTIVE_MODEL.name,
          modelVersion: ACTIVE_MODEL.version,
        },
        select: { gymId: true, scopeType: true, scope: true },
        orderBy: { createdAt: "desc" },
      });
      if (!seed) throw new Error(`No embedding found for imageId "${input.imageId}".`);
      const seedGymId =
        seed.gymId ??
        (seed.scopeType == null && seed.scope?.startsWith("GYM:")
          ? parseInt(seed.scope.split(":")[1])
          : null);
      const numericId = isNumeric(input.imageId) ? Number(input.imageId) : null;
      if (input.scope === "GLOBAL") {
        const seedQuery = `WITH seed AS (
            SELECT ie."embeddingVec" AS qvec
            FROM "ImageEmbedding" ie
            WHERE (ie."gymImageId" = '${input.imageId}' OR (${numericId !== null} AND ie."imageId" = ${numericId}))
              AND ie."modelVendor" = '${ACTIVE_MODEL.vendor}'
              AND ie."modelName"   = '${ACTIVE_MODEL.name}'
              AND ie."modelVersion"= '${ACTIVE_MODEL.version}'
            ORDER BY ie."createdAt" DESC
            LIMIT 1
          )
          SELECT
            ei.id AS image_id,
            ei."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> seed.qvec) AS score,
            ei."storageKey" AS storage_key
          FROM seed
          JOIN "ImageEmbedding" ie ON ie."scope_type" = 'GLOBAL'
          JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
          WHERE ie."modelVendor" = '${ACTIVE_MODEL.vendor}'
            AND ie."modelName"   = '${ACTIVE_MODEL.name}'
            AND ie."modelVersion"= '${ACTIVE_MODEL.version}'
          ORDER BY ie."embeddingVec" <=> seed.qvec
          LIMIT ${limit}`;
        hits = await this.prisma.$queryRawUnsafe(seedQuery);
      } else {
        if (seedGymId == null) {
          throw new Error("Seed image must belong to a gym for GYM scope search");
        }
        const gymQuery = `WITH seed AS (
            SELECT ie."embeddingVec" AS qvec, ie."gym_id" AS seed_gym_id
            FROM "ImageEmbedding" ie
            WHERE (ie."gymImageId" = '${input.imageId}' OR (${numericId !== null} AND ie."imageId" = ${numericId}))
              AND ie."modelVendor" = '${ACTIVE_MODEL.vendor}'
              AND ie."modelName"   = '${ACTIVE_MODEL.name}'
              AND ie."modelVersion"= '${ACTIVE_MODEL.version}'
            ORDER BY ie."createdAt" DESC
            LIMIT 1
          )
          SELECT
            gi.id AS image_id,
            gi."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> seed.qvec) AS score,
            gi."storageKey" AS storage_key
          FROM seed
          JOIN "ImageEmbedding" ie ON ie."scope_type" = 'GYM' AND ie."gym_id" = seed.seed_gym_id
          JOIN "GymEquipmentImage" gi ON gi.id = ie."gymImageId"
          WHERE ie."modelVendor" = '${ACTIVE_MODEL.vendor}'
            AND ie."modelName"   = '${ACTIVE_MODEL.name}'
            AND ie."modelVersion"= '${ACTIVE_MODEL.version}'
          ORDER BY ie."embeddingVec" <=> seed.qvec
          LIMIT ${limit}`;
        hits = await this.prisma.$queryRawUnsafe(gymQuery);
      }
    } else if (input.vector) {
      const vectorParam = `[${input.vector
        .map((v) => (Number.isFinite(v) ? v : 0))
        .join(",")}]`;
      if (input.scope === "GLOBAL") {
        const vecQuery = `SELECT
            ei.id AS image_id,
            ei."equipmentId" AS equipment_id,
            1.0 - (ie."embeddingVec" <=> ${vectorParam}::vector) AS score,
            ei."storageKey" AS storage_key
          FROM "ImageEmbedding" ie
          JOIN "EquipmentImage" ei ON ei.id = ie."imageId"
          WHERE ie."scope_type" = 'GLOBAL'
            AND ie."modelVendor" = '${ACTIVE_MODEL.vendor}'
            AND ie."modelName"   = '${ACTIVE_MODEL.name}'
            AND ie."modelVersion"= '${ACTIVE_MODEL.version}'
          ORDER BY ie."embeddingVec" <=> ${vectorParam}::vector
          LIMIT ${limit}`;
        hits = await this.prisma.$queryRawUnsafe(vecQuery);
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