jest.mock('../../../src/modules/images/image-worker.js', () => ({
  // Return a resolved Promise to satisfy calls expecting a thenable
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { AppRole, AuthContext, UserRole } from '../../../src/modules/auth/auth.types';
import {
  GlobalCandidateScoreInput,
  ImagePromotionService,
  cosine,
  parsePgvectorText,
  scoreGlobalCandidate,
} from '../../../src/modules/images/image-promotion.service';
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

describe('helper utilities', () => {
  test('parsePgvectorText parses valid arrays', () => {
    expect(parsePgvectorText('[1.5, -2, 0]')).toEqual([1.5, -2, 0]);
  });

  test('parsePgvectorText returns null for invalid inputs', () => {
    expect(parsePgvectorText('not-an-array')).toBeNull();
    expect(parsePgvectorText('[a, b]')).toBeNull();
  });

  test('cosine handles mismatched inputs gracefully', () => {
    expect(cosine([1, 2], [1])).toBe(0);
    expect(cosine([0, 0], [0, 0])).toBe(0);
  });

  test('scoreGlobalCandidate composes reason codes', () => {
    const input: GlobalCandidateScoreInput = {
      globalCount: 0,
      hiRes: true,
      simMax: 0.99,
    };
    const result = scoreGlobalCandidate(input);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toEqual(expect.arrayContaining(['NO_GLOBAL', 'HI_RES', 'FRESH']));
  });
});

describe('maybeCreateGlobalSuggestion', () => {
  function setup(overrides?: Partial<ReturnType<typeof createSuggestionPrismaMock>>) {
    const base = createSuggestionPrismaMock();
    const prisma = {
      ...base,
      ...(overrides ?? {}),
    } as ReturnType<typeof createSuggestionPrismaMock>;
    const svc = new ImagePromotionService(prisma as unknown as PrismaClient);
    (svc as any).s3 = { send: jest.fn().mockResolvedValue({ ContentLength: 400 * 1024 }) };
    jest.spyOn(svc as any, 's3CopyIfMissing').mockResolvedValue(undefined);
    return { svc, prisma };
  }

  function createSuggestionPrismaMock() {
    return {
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValue([{ id: 'dup', v: '[0.9,0.9]' }]),
      globalImageSuggestion: { upsert: jest.fn() },
    } as any;
  }

  test('skips when vector or checksum missing', async () => {
    const { svc, prisma } = setup();
    await (svc as any).maybeCreateGlobalSuggestion({
      equipmentId: 1,
      gymImageId: 'g1',
      storageKey: 'key',
      sha256: '',
      vector: [],
    });
    expect(prisma.globalImageSuggestion.upsert).not.toHaveBeenCalled();
  });

  test('persists suggestion with scoring metadata', async () => {
    const { svc, prisma } = setup();
    await (svc as any).maybeCreateGlobalSuggestion({
      equipmentId: 2,
      gymImageId: 'g1',
      storageKey: 'private/uploads/img.jpg',
      sha256: 'abc',
      vector: [1, 1],
    });

    expect((svc as any).s3CopyIfMissing).toHaveBeenCalledWith(
      'private/uploads/img.jpg',
      expect.stringContaining('private/global/candidates/2/abc.'),
    );

    expect(prisma.globalImageSuggestion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sha256: 'abc' },
        update: expect.objectContaining({
          usefulnessScore: expect.any(Number),
          reasonCodes: expect.arrayContaining(['NO_GLOBAL', 'HI_RES', 'FRESH']),
          nearDupImageId: 'dup',
        }),
      }),
    );

    const [{ update }] = prisma.globalImageSuggestion.upsert.mock.calls[0];
    expect(update.usefulnessScore).toBeGreaterThanOrEqual(0);
    expect(update.usefulnessScore).toBeLessThanOrEqual(1);
  });

  test('stops when duplicate global image already exists', async () => {
    const { svc, prisma } = setup({
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        count: jest.fn().mockResolvedValue(0),
      },
    });

    await (svc as any).maybeCreateGlobalSuggestion({
      equipmentId: 2,
      gymImageId: 'g1',
      storageKey: 'key',
      sha256: 'dup-sha',
      vector: [0.5, 0.25],
    });

    expect(prisma.globalImageSuggestion.upsert).not.toHaveBeenCalled();
  });

  test('skips when equipment already has ample coverage', async () => {
    const { svc, prisma } = setup({
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(20),
      },
    });

    await (svc as any).maybeCreateGlobalSuggestion({
      equipmentId: 2,
      gymImageId: 'g1',
      storageKey: 'key',
      sha256: 'abc',
      vector: [0.1, 0.2],
    });

    expect(prisma.globalImageSuggestion.upsert).not.toHaveBeenCalled();
  });
});

describe('promoteGymImageToGlobal', () => {
  const ctx: AuthContext = {
    userId: 1,
    appRole: AppRole.ADMIN,
    userRole: UserRole.USER,
    gymRoles: [],
    isPremium: false,
    prisma: {} as any,
    permissionService: {} as any,
    mediaService: {} as any,
    imageIntakeService: {} as any,
    imagePromotionService: {} as any,
    imageModerationService: {} as any,
    recognitionService: {} as any,
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
