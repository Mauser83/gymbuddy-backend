jest.mock('../../../src/modules/images/image-worker', () => ({
  // Return a resolved Promise to satisfy calls expecting a thenable
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { AuthContext, UserRole } from '../../../src/modules/auth/auth.types';
import { ImagePromotionService } from '../../../src/modules/images/image-promotion.service';
import { PrismaClient } from '../../../src/prisma';

process.env.EMBED_VENDOR = 'local';
process.env.EMBED_MODEL = 'openclip-vit-b32';
process.env.EMBED_VERSION = '1.0';

const ONE_BY_ONE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gL+6rYPGQAAAABJRU5ErkJggg==',
  'base64',
);

jest.spyOn(S3Client.prototype, 'send').mockImplementation((cmd: any) => {
  if (cmd instanceof HeadObjectCommand) {
    return Promise.resolve({ ContentType: 'image/png' } as any);
  }
  if (cmd instanceof CopyObjectCommand) {
    return Promise.resolve({} as any);
  }
  if (cmd instanceof GetObjectCommand) {
    return Promise.resolve({
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array(ONE_BY_ONE_PNG)),
      },
    } as any);
  }
  return Promise.resolve({} as any);
});

function createPrismaMock() {
  const prisma = {
    gymEquipmentImage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    equipmentImage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    imageQueue: {
      create: jest.fn(),
    },
    splitType: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: async (fn: any) => fn(prisma),
  } as unknown as PrismaClient;
  return prisma;
}

describe('promoteGymImageToGlobal', () => {
  const ctx: AuthContext = {
    userId: 1,
    appRole: 'ADMIN',
    userRole: UserRole.USER,
    gymRoles: [],
    isPremium: false,
    prisma: {} as any,
    permissionService: {} as any,
    mediaService: {} as any,
    imageIntakeService: {} as any,
    imagePromotionService: {} as any,
    imageModerationService: {} as any,
  };

  it('copies object and creates equipment image', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue({
      id: 'g1',
      gymId: 10,
      equipmentId: 20,
      storageKey: 'private/uploads/10/2025/01/img.jpg',
      sha256: 'abc',
      status: 'APPROVED',
      isSafe: true,
      embedding: null,
      modelVendor: null,
      modelName: null,
      modelVersion: null,
    });
    (prisma.equipmentImage.create as any).mockImplementation(({ data }: any) => ({
      id: 'e1',
      storageKey: data.storageKey,
    }));
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx);
    expect(res.equipmentImage.id).toBe('e1');
    expect(prisma.equipmentImage.create).toHaveBeenCalled();
    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageId: 'e1', storageKey: null }),
    });
    expect(res.destinationKey.startsWith('private/global/equipment/20/approved/')).toBe(true);
  });

  it('skips embed queue when gym embedding exists', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue({
      id: 'g1',
      gymId: 10,
      equipmentId: 20,
      storageKey: 'private/uploads/10/2025/01/img.jpg',
      sha256: 'abc',
      status: 'APPROVED',
      isSafe: true,
      embedding: [0.1, 0.2],
      modelVendor: process.env.EMBED_VENDOR,
      modelName: process.env.EMBED_MODEL,
      modelVersion: process.env.EMBED_VERSION,
    });
    (prisma.equipmentImage.create as any).mockImplementation(({ data }: any) => ({
      id: 'e1',
      storageKey: data.storageKey,
    }));
    (prisma.$queryRaw as any).mockResolvedValue([{ embedding_text: '[0.1,0.2]' }]);
    const svc = new ImagePromotionService(prisma);
    await svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx);
    expect(prisma.imageQueue.create).not.toHaveBeenCalled();
    expect(prisma.equipmentImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modelVendor: process.env.EMBED_VENDOR,
        modelName: process.env.EMBED_MODEL,
        modelVersion: process.env.EMBED_VERSION,
      }),
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('returns existing on duplicate sha', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue({
      id: 'g1',
      gymId: 10,
      equipmentId: 20,
      storageKey: 'private/uploads/10/2025/01/img.jpg',
      sha256: 'abc',
      status: 'APPROVED',
      isSafe: true,
      embedding: null,
      modelVendor: null,
      modelName: null,
      modelVersion: null,
    });
    (prisma.equipmentImage.findFirst as any).mockResolvedValue({
      id: 'e1',
      storageKey: 'private/global/equipment/20/approved/existing.jpg',
    });
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx);
    expect(res.equipmentImage.id).toBe('e1');
    expect(prisma.equipmentImage.create).not.toHaveBeenCalled();
  });
});
