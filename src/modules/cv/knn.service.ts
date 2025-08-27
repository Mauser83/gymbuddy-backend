import { prisma } from "../../lib/prisma";

type Scope = "GLOBAL" | "GYM";

export async function knnSearchService(input: {
  imageId: string;
  scope: Scope;
  limit?: number;
  gymId?: number;
}) {
  const { imageId, scope, gymId } = input;
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));

  const src =
    scope === "GYM"
      ? await prisma.$queryRawUnsafe<[{ embedding: number[] } | null]>(
          `
          SELECT embedding FROM "GymEquipmentImage"
          WHERE id = $1 AND "gymId" = $2 AND embedding IS NOT NULL
          `,
          imageId,
          gymId
        )
      : await prisma.$queryRawUnsafe<[{ embedding: number[] } | null]>(
          `
          SELECT embedding FROM "EquipmentImage"
          WHERE id = $1 AND embedding IS NOT NULL
          `,
          imageId
        );

  const vec = (src as any[])[0]?.embedding;
  if (!vec) {
    const fallback =
      scope === "GYM"
        ? await prisma.$queryRawUnsafe<[{ embedding: number[] } | null]>(
            `SELECT embedding FROM "EquipmentImage" WHERE id = $1 AND embedding IS NOT NULL`,
            imageId
          )
        : await prisma.$queryRawUnsafe<[{ embedding: number[] } | null]>(
            `SELECT embedding FROM "GymEquipmentImage" WHERE id = $1 AND embedding IS NOT NULL`,
            imageId
          );
    const fvec = (fallback as any[])[0]?.embedding;
    if (!fvec) throw new Error("Source image embedding not found");
    return scope === "GYM"
      ? await searchGym(fvec, { gymId: gymId!, limit, excludeId: imageId })
      : await searchGlobal(fvec, { limit, excludeId: imageId });
  }

  return scope === "GYM"
    ? await searchGym(vec, { gymId: gymId!, limit, excludeId: imageId })
    : await searchGlobal(vec, { limit, excludeId: imageId });
}

async function searchGlobal(
  vec: number[],
  opts: { limit: number; excludeId: string }
) {
  return prisma.$queryRawUnsafe<
    Array<{ id: string; equipmentId: number | null; score: number }>
  >(
    `
    SELECT id, "equipmentId", 1 - (embedding <=> $1) AS score
    FROM "EquipmentImage"
    WHERE embedding IS NOT NULL AND id <> $2
    ORDER BY embedding <-> $1
    LIMIT $3
    `,
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
    `
    SELECT id, "equipmentId", 1 - (embedding <=> $1) AS score
    FROM "GymEquipmentImage"
    WHERE embedding IS NOT NULL
      AND "gymId" = $2
      AND id <> $3
    ORDER BY embedding <-> $1
    LIMIT $4
    `,
    vec,
    opts.gymId,
    opts.excludeId,
    opts.limit
  );
}