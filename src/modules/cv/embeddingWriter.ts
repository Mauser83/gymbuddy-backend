import { prisma } from "../../lib/prisma";

/**
 * Persist an embedding into the correct table/row.
 * @param target   'GLOBAL' | 'GYM'
 * @param imageId  id of the EquipmentImage or GymEquipmentImage row
 * @param gymId    required when target === 'GYM'
 * @param vector   number[512]
 */
export async function writeImageEmbedding(params: {
  target: 'GLOBAL' | 'GYM';
  imageId: string;
  gymId?: number;
  vector: number[];
}) {
  const { target, imageId, gymId, vector } = params;

  if (target === 'GLOBAL') {
    // ensure row exists, then update embedding
    await prisma.$executeRawUnsafe(
      `UPDATE "EquipmentImage" SET embedding = $1 WHERE id = $2`,
      vector, imageId
    );
    return;
  }

  if (!gymId) throw new Error('gymId is required for GYM embedding write');
  await prisma.$executeRawUnsafe(
    `UPDATE "GymEquipmentImage" SET embedding = $1 WHERE id = $2 AND "gymId" = $3`,
    vector, imageId, gymId
  );
}