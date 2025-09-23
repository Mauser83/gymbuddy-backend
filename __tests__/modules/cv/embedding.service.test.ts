import { randomUUID } from 'crypto';

import { getLatestEmbeddedImageService } from '../../../src/modules/cv/embedding.service';
import { cleanDB, prisma } from '../../testUtils';

const DIM = 512;
function padVec(seed: number[]) {
  return Array.from({ length: DIM }, (_, i) => seed[i] ?? 0);
}

async function createEquipment() {
  const cat = await prisma.equipmentCategory.create({
    data: { name: `cat-${randomUUID()}`, slug: `cat-${randomUUID()}` },
  });
  const sub = await prisma.equipmentSubcategory.create({
    data: { name: `sub-${randomUUID()}`, slug: `sub-${randomUUID()}`, categoryId: cat.id },
  });
  const equipment = await prisma.equipment.create({
    data: {
      name: `eq-${randomUUID()}`,
      brand: 'brand',
      categoryId: cat.id,
      subcategoryId: sub.id,
    },
  });
  return { equipment };
}

async function createGymWithEquipment(equipmentId: number) {
  const gym = await prisma.gym.create({
    data: {
      name: `gym-${randomUUID()}`,
      country: 'US',
      city: 'city',
      address: 'addr',
    },
  });
  const gymEquipment = await prisma.gymEquipment.create({
    data: { gymId: gym.id, equipmentId, quantity: 1 },
  });
  return { gym, gymEquipment };
}

async function createGymImage(opts: {
  gymId: number;
  equipmentId: number;
  gymEquipmentId: number;
  capturedAt: Date;
}) {
  const { gymId, equipmentId, gymEquipmentId, capturedAt } = opts;
  const equipmentImageId = randomUUID();
  await prisma.equipmentImage.create({
    data: {
      id: equipmentImageId,
      equipmentId,
      storageKey: randomUUID(),
      mimeType: 'image/jpeg',
      width: 1,
      height: 1,
      sha256: randomUUID(),
      createdAt: capturedAt,
    },
  });

  const vec = `[${padVec([1]).join(',')}]`;
  const gymImageId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "GymEquipmentImage" ("id","gymId","equipmentId","gymEquipmentId","imageId","storageKey","sha256","embedding","capturedAt")
    VALUES (${gymImageId}, ${gymId}, ${equipmentId}, ${gymEquipmentId}, ${equipmentImageId}, ${randomUUID()}, ${randomUUID()}, ${vec}::vector, ${capturedAt})
  `;
  return gymImageId;
}

async function createGlobalImage(opts: { equipmentId: number; createdAt: Date; seed?: number[] }) {
  const { equipmentId, createdAt, seed = [2] } = opts;
  const imageId = randomUUID();
  await prisma.equipmentImage.create({
    data: {
      id: imageId,
      equipmentId,
      storageKey: randomUUID(),
      mimeType: 'image/jpeg',
      width: 1,
      height: 1,
      sha256: randomUUID(),
      createdAt,
    },
  });
  const vec = `[${padVec(seed).join(',')}]`;
  await prisma.$executeRaw`
    UPDATE "EquipmentImage" SET embedding = ${vec}::vector WHERE id = ${imageId}
  `;
  return imageId;
}

describe('getLatestEmbeddedImageService', () => {
  beforeEach(async () => {
    await cleanDB();
  });

  it('returns latest gym image by capturedAt', async () => {
    const { equipment } = await createEquipment();
    const { gym, gymEquipment } = await createGymWithEquipment(equipment.id);

    await createGymImage({
      gymId: gym.id,
      equipmentId: equipment.id,
      gymEquipmentId: gymEquipment.id,
      capturedAt: new Date('2024-01-01T00:00:00Z'),
    });
    const latestImageId = await createGymImage({
      gymId: gym.id,
      equipmentId: equipment.id,
      gymEquipmentId: gymEquipment.id,
      capturedAt: new Date('2024-02-01T00:00:00Z'),
    });

    const result = await getLatestEmbeddedImageService({
      scope: 'GYM',
      gymId: gym.id,
      equipmentId: equipment.id,
    });

    expect(result).toBeTruthy();
    expect(result!.imageId).toBe(latestImageId);
    expect(new Date(result!.createdAt).toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(result!.scope).toBe('GYM');
  });

  it('returns latest global image by createdAt', async () => {
    const { equipment } = await createEquipment();

    await createGlobalImage({
      equipmentId: equipment.id,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      seed: [3],
    });
    const latestGlobalId = await createGlobalImage({
      equipmentId: equipment.id,
      createdAt: new Date('2024-03-01T00:00:00Z'),
      seed: [4],
    });

    const result = await getLatestEmbeddedImageService({
      scope: 'GLOBAL',
      equipmentId: equipment.id,
    });

    expect(result).toBeTruthy();
    expect(result!.imageId).toBe(latestGlobalId);
    expect(new Date(result!.createdAt).toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(result!.scope).toBe('GLOBAL');
  });

  it('prefers gym image when scope AUTO has gym data', async () => {
    const { equipment } = await createEquipment();
    const { gym, gymEquipment } = await createGymWithEquipment(equipment.id);

    await createGlobalImage({
      equipmentId: equipment.id,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      seed: [5],
    });
    const gymImageId = await createGymImage({
      gymId: gym.id,
      equipmentId: equipment.id,
      gymEquipmentId: gymEquipment.id,
      capturedAt: new Date('2024-02-01T00:00:00Z'),
    });

    const result = await getLatestEmbeddedImageService({
      scope: 'AUTO',
      gymId: gym.id,
      equipmentId: equipment.id,
    });

    expect(result).toBeTruthy();
    expect(result!.scope).toBe('GYM');
    expect(result!.imageId).toBe(gymImageId);
  });

  it('falls back to global when AUTO scope has no gym images', async () => {
    const { equipment } = await createEquipment();
    const { gym } = await createGymWithEquipment(equipment.id);

    const latestGlobalId = await createGlobalImage({
      equipmentId: equipment.id,
      createdAt: new Date('2024-04-01T00:00:00Z'),
      seed: [6],
    });

    const result = await getLatestEmbeddedImageService({
      scope: 'AUTO',
      gymId: gym.id,
      equipmentId: equipment.id,
    });

    expect(result).toBeTruthy();
    expect(result!.scope).toBe('GLOBAL');
    expect(result!.imageId).toBe(latestGlobalId);
  });

  it('requires gymId when scope is GYM or AUTO', async () => {
    await expect(
      getLatestEmbeddedImageService({ scope: 'GYM' }),
    ).rejects.toThrow('gymId is required for this scope');
    await expect(
      getLatestEmbeddedImageService({ scope: 'AUTO' }),
    ).rejects.toThrow('gymId is required for this scope');
  });
});