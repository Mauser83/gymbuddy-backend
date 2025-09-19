import { prisma } from '../../lib/prisma';

type Scope = 'GLOBAL' | 'GYM' | 'AUTO';

type Row = { id: string; equipmentId: number | null; score: number; storageKey: string };

type VecRow = { equipmentId: number | null; score: number; storageKey: string; id: string };

export async function knnSearchService(input: {
  imageId: string;
  scope: Scope;
  limit?: number;
  gymId?: number;
  minScore?: number;
}) {
  const { imageId, scope, gymId } = input;
  const limit = Math.max(1, Math.min(input.limit ?? 10, 100));
  const minScore = clamp01(input.minScore ?? 0.72);

  if ((scope === 'GYM' || scope === 'AUTO') && !gymId) {
    throw new Error('gymId is required for this scope');
  }

  if (scope === 'GLOBAL') {
    return searchGlobalFromSourceId({ sourceId: imageId, excludeId: imageId, limit });
  }

  if (scope === 'GYM') {
    return searchGymFromSourceId({ sourceId: imageId, gymId: gymId!, excludeId: imageId, limit });
  }

  // AUTO: try GLOBAL, fall back to GYM if top score < minScore
  const global = await searchGlobalFromSourceId({ sourceId: imageId, excludeId: imageId, limit });
  if ((global[0]?.score ?? 0) >= minScore) return global;
  return searchGymFromSourceId({ sourceId: imageId, gymId: gymId!, excludeId: imageId, limit });
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

/**
 * GLOBAL: prefer the source embedding from EquipmentImage; if not found, fall back to GymEquipmentImage.
 * We never fetch the vector into JS; we CROSS JOIN the chosen source embedding in SQL.
 */
async function searchGlobalFromSourceId(opts: {
  sourceId: string;
  excludeId: string;
  limit: number;
}): Promise<Row[]> {
  const { sourceId, excludeId, limit } = opts;

  return prisma.$queryRawUnsafe<Row[]>(
    `
    WITH src AS (
      SELECT embedding FROM (
        SELECT embedding, 1 AS pri
          FROM "EquipmentImage"
         WHERE id = $1 AND embedding IS NOT NULL
        UNION ALL
        SELECT embedding, 2 AS pri
          FROM "GymEquipmentImage"
         WHERE id = $1 AND embedding IS NOT NULL
      ) s
      ORDER BY pri
      LIMIT 1
    )
    SELECT ei.id,
           ei."equipmentId",
           ei."storageKey",
           1 - (ei.embedding <=> src.embedding) AS score
      FROM "EquipmentImage" ei
      CROSS JOIN src
     WHERE ei.embedding IS NOT NULL
       AND ei.id <> $2
     ORDER BY ei.embedding <-> src.embedding
     LIMIT $3
    `,
    sourceId,
    excludeId,
    limit,
  );
}

/**
 * GYM: prefer the source embedding from GymEquipmentImage (for the same gym); if not found, fall back to EquipmentImage.
 */
async function searchGymFromSourceId(opts: {
  sourceId: string;
  gymId: number;
  excludeId: string;
  limit: number;
}): Promise<Row[]> {
  const { sourceId, gymId, excludeId, limit } = opts;

  return prisma.$queryRawUnsafe<Row[]>(
    `
    WITH src AS (
      SELECT embedding FROM (
        SELECT embedding, 1 AS pri
          FROM "GymEquipmentImage"
         WHERE id = $1 AND "gymId" = $2 AND embedding IS NOT NULL
        UNION ALL
        SELECT embedding, 2 AS pri
          FROM "EquipmentImage"
         WHERE id = $1 AND embedding IS NOT NULL
      ) s
      ORDER BY pri
      LIMIT 1
    )
    SELECT ge.id,
           ge."equipmentId",
           ge."storageKey",
           1 - (ge.embedding <=> src.embedding) AS score
      FROM "GymEquipmentImage" ge
      CROSS JOIN src
     WHERE ge.embedding IS NOT NULL
       AND ge."gymId" = $2
       AND ge.id <> $3
     ORDER BY ge.embedding <-> src.embedding
     LIMIT $4
    `,
    sourceId,
    gymId,
    excludeId,
    limit,
  );
}

export async function knnFromVectorGlobal(params: {
  vector: number[];
  limit: number;
  gymId?: number;
}): Promise<VecRow[]> {
  const { vector, limit, gymId } = params;

  const gymFilter =
    gymId == null
      ? ``
      : `
      AND ei."equipmentId" IN (
        SELECT ge."equipmentId"
          FROM "GymEquipment" ge
         WHERE ge."gymId" = ${Number(gymId)}
      )
    `;

  return prisma.$queryRawUnsafe<VecRow[]>(
    `
    WITH src AS (
      SELECT CAST($1 AS vector(512)) AS embedding
    )
    SELECT ei.id,
           ei."equipmentId",
           ei."storageKey",
           1 - (ei.embedding <=> src.embedding) AS score
      FROM "EquipmentImage" ei
      CROSS JOIN src
     WHERE ei.embedding IS NOT NULL
       ${gymFilter}
     ORDER BY ei.embedding <-> src.embedding
     LIMIT $2
    `,
    vector,
    Math.max(1, Math.min(limit, 100)),
  );
}

export async function knnFromVectorGym(params: {
  vector: number[];
  gymId: number;
  limit: number;
}): Promise<VecRow[]> {
  const { vector, gymId, limit } = params;
  return prisma.$queryRawUnsafe<VecRow[]>(
    `
    WITH src AS (
      SELECT CAST($1 AS vector(512)) AS embedding
    )
    SELECT ge.id,
           ge."equipmentId",
           ge."storageKey",
           1 - (ge.embedding <=> src.embedding) AS score
      FROM "GymEquipmentImage" ge
      CROSS JOIN src
     WHERE ge.embedding IS NOT NULL
       AND ge."gymId" = $2
     ORDER BY ge.embedding <-> src.embedding
     LIMIT $3
    `,
    vector,
    gymId,
    Math.max(1, Math.min(limit, 100)),
  );
}
