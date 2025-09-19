import { prisma } from '../../lib/prisma';

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
  modelVendor: string;
  modelName: string;
  modelVersion: string;
}) {
  const { target, imageId, gymId, vector, modelVendor, modelName, modelVersion } = params;

  if (target === 'GLOBAL') {
    // ensure row exists, then update embedding
    await prisma.$executeRawUnsafe(
      `UPDATE "EquipmentImage" SET embedding = $1, "modelVendor" = $2, "modelName" = $3, "modelVersion" = $4 WHERE id = $5`,
      vector,
      modelVendor,
      modelName,
      modelVersion,
      imageId,
    );
    return;
  }

  if (!gymId) throw new Error('gymId is required for GYM embedding write');
  await prisma.$executeRawUnsafe(
    `UPDATE "GymEquipmentImage" SET embedding = $1, "modelVendor" = $2, "modelName" = $3, "modelVersion" = $4 WHERE id = $5 AND "gymId" = $6`,
    vector,
    modelVendor,
    modelName,
    modelVersion,
    imageId,
    gymId,
  );
}
