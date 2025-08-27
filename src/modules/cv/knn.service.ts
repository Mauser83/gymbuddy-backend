import { prisma } from "../../lib/prisma";
type Scope = "GLOBAL" | "GYM" | "AUTO";

export async function knnSearchService(input: {
  imageId: string;
  scope: Scope;
  limit?: number;
  gymId?: number;
  minScore?: number;
}) {
  const { imageId, scope, gymId } = input;
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const minScore = Math.max(0, Math.min(input.minScore ?? 0.72, 1));

  // 1) load source vector (prefer scoped table when scope === 'GYM')
  const src =
    scope === "GYM"
      ? await prisma.$queryRawUnsafe<Array<{ embedding: number[] }>>(
          `SELECT embedding FROM "GymEquipmentImage"
           WHERE id = $1 AND "gymId" = $2 AND embedding IS NOT NULL LIMIT 1`,
          imageId,
          gymId
        )
      : await prisma.$queryRawUnsafe<Array<{ embedding: number[] }>>(
          `SELECT embedding FROM "EquipmentImage"
           WHERE id = $1 AND embedding IS NOT NULL LIMIT 1`,
          imageId
        );

  const vec = src[0]?.embedding;
  if (!vec) {
    // fallback if wrong id was pasted
    const fb =
      scope === "GYM"
        ? await prisma.$queryRawUnsafe<Array<{ embedding: number[] }>>(
            `SELECT embedding FROM "EquipmentImage" WHERE id = $1 AND embedding IS NOT NULL LIMIT 1`,
            imageId
          )
        : await prisma.$queryRawUnsafe<Array<{ embedding: number[] }>>(
            `SELECT embedding FROM "GymEquipmentImage" WHERE id = $1 AND embedding IS NOT NULL LIMIT 1`,
            imageId
          );
    if (!fb[0]?.embedding) throw new Error("Source image embedding not found");
    return scope === "GYM"
      ? await searchGym(fb[0].embedding, { gymId: gymId!, limit, excludeId: imageId })
      : scope === "GLOBAL"
      ? await searchGlobal(fb[0].embedding, { limit, excludeId: imageId })
      : await handleAuto(fb[0].embedding, { limit, gymId: gymId!, excludeId: imageId, minScore });
  }

  // 2) scoped or AUTO
  if (scope === "GLOBAL") return searchGlobal(vec, { limit, excludeId: imageId });
  if (scope === "GYM") return searchGym(vec, { gymId: gymId!, limit, excludeId: imageId });
  return handleAuto(vec, { limit, gymId: gymId!, excludeId: imageId, minScore });
}

async function handleAuto(
  vec: number[],
  opts: { limit: number; gymId: number; excludeId: string; minScore: number }
) {
  const global = await searchGlobal(vec, { limit: opts.limit, excludeId: opts.excludeId });
  if ((global[0]?.score ?? 0) >= opts.minScore) return global;
  const gym = await searchGym(vec, { gymId: opts.gymId, limit: opts.limit, excludeId: opts.excludeId });
  return gym;
}

async function searchGlobal(
  vec: number[],
  opts: { limit: number; excludeId: string }
) {
  return prisma.$queryRawUnsafe<
    Array<{ id: string; equipmentId: number | null; score: number }>
  >(
    `SELECT id, "equipmentId", 1 - (embedding <=> $1) AS score
     FROM "EquipmentImage"
     WHERE embedding IS NOT NULL AND id <> $2
     ORDER BY embedding <-> $1
     LIMIT $3`,
    vec,
    opts.excludeId,
    opts.limit
  );
}

async function searchGym(
  vec: number[],
  opts: { gymId: number; limit: number; excludeId: string }
) {
  return prisma.$queryRawUnsafe<
    Array<{ id: string; equipmentId: number | null; score: number }>
  >(
    `SELECT id, "equipmentId", 1 - (embedding <=> $1) AS score
     FROM "GymEquipmentImage"
     WHERE embedding IS NOT NULL AND "gymId" = $2 AND id <> $3
     ORDER BY embedding <-> $1
     LIMIT $4`,
    vec,
    opts.gymId,
    opts.excludeId,
    opts.limit
  );
}