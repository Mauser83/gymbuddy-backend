jest.mock('../../../src/modules/images/image-worker.js', () => ({
  // Return a resolved Promise to satisfy calls expecting a thenable
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/modules/cv/embeddingWriter.js', () => ({
  writeImageEmbedding: jest.fn(() => Promise.resolve()),
}));

import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { AppRole, AuthContext, UserRole } from '../../../src/modules/auth/auth.types';
import { writeImageEmbedding } from '../../../src/modules/cv/embeddingWriter';
import * as GlobalSuggestions from '../../../src/modules/images/global-suggestions.helper';
import { ImagePromotionService } from '../../../src/modules/images/image-promotion.service';
import { PrismaClient } from '../../../src/prisma';

process.env.R2_BUCKET = process.env.R2_BUCKET || 'bucket';
process.env.R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'acc';

const { cosine, parsePgvectorText, scoreGlobalCandidate, maybeSuggestGlobalFromGymImage } =
  GlobalSuggestions;
type GlobalCandidateScoreInput = GlobalSuggestions.GlobalCandidateScoreInput;

process.env.EMBED_VENDOR = 'local';
process.env.EMBED_MODEL = 'openclip-vit-b32';
process.env.EMBED_VERSION = '1.0';

const ONE_BY_ONE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gL+6rYPGQAAAABJRU5ErkJggg==',
  'base64',
);

const baseContext: AuthContext = {
  userId: 1,
  appRole: AppRole.ADMIN,
  userRole: UserRole.USER,
  gymRoles: [],
  isPremium: false,
  prisma: {} as any,
  permissionService: { checkPermission: jest.fn() } as any,
  mediaService: {} as any,
  imageIntakeService: {} as any,
  imagePromotionService: {} as any,
  imageModerationService: {} as any,
  recognitionService: {} as any,
};

function createCtx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    ...baseContext,
    ...overrides,
  };
}

const writeImageEmbeddingMock = writeImageEmbedding as jest.MockedFunction<
  typeof writeImageEmbedding
>;

const s3SendMock = jest.spyOn(S3Client.prototype, 'send').mockImplementation((cmd: any) => {
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

beforeEach(() => {
  s3SendMock.mockClear();
  writeImageEmbeddingMock.mockClear();
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
    globalImageSuggestion: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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

describe('maybeSuggestGlobalFromGymImage', () => {
  function createSuggestionPrismaMock() {
    return {
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'dup', v: '[0.9,0.9]' }]),
      globalImageSuggestion: { upsert: jest.fn() },
    } as any;
  }

  function createDeps(overrides?: Partial<ReturnType<typeof createSuggestionPrismaMock>>) {
    const base = createSuggestionPrismaMock();
    const prisma = {
      ...base,
      ...(overrides ?? {}),
    } as ReturnType<typeof createSuggestionPrismaMock>;
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof HeadObjectCommand) {
        const commandInput = (cmd as { input?: { Key?: string } }).input;
        const key = String(commandInput?.Key ?? '');
        if (key.includes('private/global/candidates')) {
          const err: any = new Error('not found');
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        return { ContentLength: 400 * 1024 } as any;
      }
      if (cmd instanceof CopyObjectCommand) return {} as any;
      return {} as any;
    });
    const s3 = { send } as unknown as S3Client;
    return {
      prisma,
      deps: { prisma: prisma as unknown as PrismaClient, s3, bucket: 'bucket' },
      send,
    };
  }

  test('skips when vector or checksum missing', async () => {
    const { prisma, deps } = createDeps();
    await maybeSuggestGlobalFromGymImage(deps, {
      equipmentId: 1,
      gymImageId: 'g1',
      storageKey: 'key',
      sha256: '',
      vector: [],
    });
    expect(prisma.globalImageSuggestion.upsert).not.toHaveBeenCalled();
  });

  test('persists suggestion with scoring metadata', async () => {
    const { prisma, deps, send } = createDeps();
    await maybeSuggestGlobalFromGymImage(deps, {
      equipmentId: 2,
      gymImageId: 'g1',
      storageKey: 'private/uploads/img.jpg',
      sha256: 'abc',
      vector: [1, 1],
    });

    const copyCall = send.mock.calls.find(([cmd]) => cmd instanceof CopyObjectCommand);
    expect(copyCall).toBeDefined();
    expect(copyCall?.[0].input?.Key).toContain('private/global/candidates/2/abc');

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
    const { prisma, deps } = createDeps({
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        count: jest.fn().mockResolvedValue(0),
      },
    });

    await maybeSuggestGlobalFromGymImage(deps, {
      equipmentId: 2,
      gymImageId: 'g1',
      storageKey: 'key',
      sha256: 'dup-sha',
      vector: [0.5, 0.25],
    });

    expect(prisma.globalImageSuggestion.upsert).not.toHaveBeenCalled();
  });

  test('skips when equipment already has ample coverage', async () => {
    const { prisma, deps } = createDeps({
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(20),
      },
    });

    await maybeSuggestGlobalFromGymImage(deps, {
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
  const ctx = createCtx();

  const createGymImage = (overrides?: Partial<any>) => ({
    id: 'g1',
    gymId: 10,
    equipmentId: 20,
    storageKey: 'private/uploads/10/2025/01/img.jpg',
    sha256: 'abc',
    status: 'APPROVED',
    isSafe: true,
    angleId: null,
    heightId: null,
    lightingId: null,
    mirrorId: null,
    distanceId: null,
    sourceId: null,
    splitId: null,
    capturedByUserId: null,
    approvedByUserId: null,
    hasPerson: null,
    personCount: null,
    personBoxes: null,
    modelVendor: null,
    modelName: null,
    modelVersion: null,
    ...overrides,
  });

  it('copies object and creates equipment image', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(createGymImage());
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
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(
      createGymImage({
        embedding: [0.1, 0.2],
        modelVendor: process.env.EMBED_VENDOR,
        modelName: process.env.EMBED_MODEL,
        modelVersion: process.env.EMBED_VERSION,
      }),
    );
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
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(createGymImage());
    (prisma.equipmentImage.findFirst as any).mockResolvedValue({
      id: 'e1',
      storageKey: 'private/global/equipment/20/approved/existing.jpg',
    });
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx);
    expect(res.equipmentImage.id).toBe('e1');
    expect(prisma.equipmentImage.create).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it('throws when gym image is not approved and force is not provided', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(
      createGymImage({ status: 'PENDING' }),
    );
    const svc = new ImagePromotionService(prisma);
    await expect(svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx)).rejects.toThrow(
      'Image must be APPROVED before promotion',
    );
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it('throws when gym image failed safety checks', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(
      createGymImage({ isSafe: false }),
    );
    const svc = new ImagePromotionService(prisma);
    await expect(svc.promoteGymImageToGlobal({ id: 'g1' } as any, ctx)).rejects.toThrow(
      'Image failed safety checks',
    );
  });

  it('rejects force usage for non-admins', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(createGymImage());
    const svc = new ImagePromotionService(prisma);
    const moderatorCtx: AuthContext = {
      ...createCtx(),
      appRole: AppRole.MODERATOR,
      permissionService: { checkPermission: () => true } as any,
    };
    await expect(
      svc.promoteGymImageToGlobal({ id: 'g1', force: true } as any, moderatorCtx),
    ).rejects.toThrow('force requires admin role');
  });

  it('allows admins to force promotion when checks would fail', async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUnique as any).mockResolvedValue(
      createGymImage({ status: 'PENDING', isSafe: false, sha256: null }),
    );
    (prisma.equipmentImage.create as any).mockImplementation(({ data }: any) => ({
      id: 'e2',
      storageKey: data.storageKey,
    }));
    (prisma.$queryRaw as any).mockResolvedValue([{ embedding_text: null }]);
    const svc = new ImagePromotionService(prisma);
    const result = await svc.promoteGymImageToGlobal({ id: 'g1', force: true } as any, ctx);
    expect(result.equipmentImage.id).toBe('e2');
    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ imageId: 'e2', jobType: 'EMBED' }),
    });
    expect(result.destinationKey).toContain('private/global/equipment/20/approved/');
  });
});

describe('listTrainingCandidates', () => {
  it('maps database rows to DTOs with pagination cursor', async () => {
    const createdAt = new Date('2025-01-02T03:04:05.000Z');
    const processedAt = new Date('2025-01-03T04:05:06.000Z');
    const nextCreatedAt = new Date('2025-02-01T00:00:00.000Z');

    const prisma = {
      trainingCandidate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cand-1',
            gymId: 7,
            gymEquipmentId: 'ge-1',
            storageKey: 'private/training/cand-1.jpg',
            status: 'pending',
            safetyReasons: ['SAFE'],
            createdAt,
            capturedAt: createdAt,
            uploader: { id: 42, username: 'snapper' },
            hash: 'hash-1',
            processedAt,
            gymEquipment: {
              equipmentId: 33,
              equipment: { name: 'Lat Pulldown' },
            },
          },
          {
            id: 'cand-2',
            gymId: 7,
            gymEquipmentId: 'ge-2',
            storageKey: 'private/training/cand-2.jpg',
            status: 'pending',
            safetyReasons: [],
            createdAt: nextCreatedAt,
            capturedAt: nextCreatedAt,
            uploader: null,
            hash: 'hash-2',
            processedAt: null,
            gymEquipment: {
              equipmentId: 44,
              equipment: { name: 'Bench' },
            },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    const result = await svc.listTrainingCandidates({ gymId: 7, limit: 1 }, createCtx());

    expect(prisma.trainingCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gymId: 7, status: 'pending' }),
        take: 2,
      }),
    );
    expect(result.items).toEqual([
      {
        id: 'cand-1',
        gymId: 7,
        gymEquipmentId: 'ge-1',
        equipmentId: 33,
        equipmentName: 'Lat Pulldown',
        storageKey: 'private/training/cand-1.jpg',
        status: 'PENDING',
        safetyReasons: ['SAFE'],
        capturedAt: createdAt.toISOString(),
        uploader: { id: 42, username: 'snapper' },
        hash: 'hash-1',
        processedAt: processedAt.toISOString(),
      },
    ]);

    const expectedCursor = Buffer.from(`cand-2|${nextCreatedAt.toISOString()}`).toString('base64');
    expect(result.nextCursor).toBe(expectedCursor);
  });

  it('throws when a row is missing gym associations', async () => {
    const prisma = {
      trainingCandidate: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cand-1',
            gymId: null,
            gymEquipmentId: null,
            storageKey: 'key',
            status: 'pending',
            safetyReasons: [],
            capturedAt: null,
            uploader: null,
            hash: null,
            processedAt: null,
            gymEquipment: null,
          },
        ]),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    await expect(svc.listTrainingCandidates({ gymId: 1 }, createCtx())).rejects.toThrow(
      'Training candidate missing required associations',
    );
  });
});

describe('training candidate moderation', () => {
  it('rejects a training candidate with an optional reason', async () => {
    const prisma = {
      trainingCandidate: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'cand-1', gymId: 9 }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    const result = await svc.rejectTrainingCandidate(
      { id: 'cand-1', reason: 'blurry' } as any,
      createCtx(),
    );

    expect(prisma.trainingCandidate.update).toHaveBeenCalledWith({
      where: { id: 'cand-1' },
      data: { status: 'rejected', rejectionReason: 'blurry' },
    });
    expect(result).toEqual({ rejected: true });
  });
});

describe('approveTrainingCandidate', () => {
  const ctx = createCtx();

  function baseCandidate(overrides: Partial<any> = {}) {
    return {
      id: 'cand-1',
      gymId: 11,
      gymEquipmentId: 22,
      storageKey: 'private/training/cand-1.jpg',
      hash: 'sha-1',
      status: 'pending',
      capturedAt: new Date('2025-01-01T00:00:00.000Z'),
      uploaderUserId: 9,
      recognitionScoreAtCapture: 0.9,
      isSafe: true,
      nsfwScore: 0.01,
      hasPerson: false,
      personCount: 0,
      personBoxes: null,
      safetyReasons: ['SAFE'],
      embeddingModelVendor: 'vendor',
      embeddingModelName: 'model',
      embeddingModelVersion: '1.0',
      ...overrides,
    };
  }

  function createApprovePrisma(overrides: Partial<any> = {}) {
    const tx = {
      gymEquipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'img-1' }),
      },
      gymEquipment: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ equipmentId: 33 }),
      },
      trainingCandidate: {
        update: jest.fn().mockResolvedValue({}),
      },
      imageQueue: {
        create: jest.fn().mockResolvedValue({}),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = {
      trainingCandidate: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseCandidate()),
      },
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      globalImageSuggestion: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ embedding_text: '[0.1,0.2]' }]),
      $transaction: jest.fn((fn: any) => fn(tx)),
      ...overrides,
    } as unknown as PrismaClient;

    return { prisma, tx };
  }

  it('approves candidate, copies media, and enqueues embedding work', async () => {
    const { prisma, tx } = createApprovePrisma();
    const svc = new ImagePromotionService(prisma);
    const suggestionSpy = jest
      .spyOn(GlobalSuggestions, 'maybeSuggestGlobalFromGymImage')
      .mockResolvedValue(undefined);

    const result = await svc.approveTrainingCandidate({ id: 'cand-1' } as any, ctx);

    expect(prisma.trainingCandidate.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'cand-1' },
      select: expect.any(Object),
    });
    expect(tx.gymEquipmentImage.findFirst).toHaveBeenCalledWith({
      where: { storageKey: 'private/gym/22/approved/sha-1.jpg' },
      select: { id: true },
    });
    expect(tx.trainingCandidate.update).toHaveBeenCalledWith({
      where: { id: 'cand-1' },
      data: { status: 'approved', imageId: 'img-1' },
    });
    expect(writeImageEmbeddingMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'GYM', imageId: 'img-1', gymId: 11 }),
    );
    expect(suggestionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ prisma, s3: expect.any(Object) }),
      {
        equipmentId: 33,
        gymImageId: 'img-1',
        storageKey: 'private/gym/22/approved/sha-1.jpg',
        sha256: 'sha-1',
        vector: [0.1, 0.2],
      },
    );
    expect(result).toEqual({
      approved: true,
      imageId: 'img-1',
      storageKey: 'private/gym/22/approved/sha-1.jpg',
    });
  });

  it('reuses existing approved image when storage already populated', async () => {
    const { prisma } = createApprovePrisma({
      $transaction: jest.fn((fn: any) =>
        fn({
          gymEquipmentImage: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
          },
          trainingCandidate: {
            update: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    });
    const svc = new ImagePromotionService(prisma);

    const result = await svc.approveTrainingCandidate({ id: 'cand-1' } as any, ctx);

    expect(result).toEqual({
      approved: true,
      imageId: 'existing',
      storageKey: 'private/gym/22/approved/sha-1.jpg',
    });
  });

  it('throws when candidate is quarantined or missing data', async () => {
    const cand = baseCandidate({ status: 'quarantined' });
    const prisma = {
      trainingCandidate: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(cand),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ embedding_text: null }]),
    } as unknown as PrismaClient;
    const svc = new ImagePromotionService(prisma);

    await expect(svc.approveTrainingCandidate({ id: 'cand-1' } as any, ctx)).rejects.toThrow(
      'Cannot approve quarantined image',
    );

    const prismaMissing = {
      trainingCandidate: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseCandidate({ hash: null })),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;
    const svcMissing = new ImagePromotionService(prismaMissing);

    await expect(svcMissing.approveTrainingCandidate({ id: 'cand-1' } as any, ctx)).rejects.toThrow(
      'Candidate not processed yet',
    );
  });
});

describe('listGlobalSuggestions', () => {
  it('returns paginated suggestions with equipment metadata', async () => {
    const createdAt = new Date('2025-05-10T01:02:03.000Z');
    const later = new Date('2025-06-01T01:02:03.000Z');

    const prisma = {
      globalImageSuggestion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'suggest-1',
            equipmentId: 77,
            gymImageId: 'gym-img-1',
            storageKey: 'private/global/candidates/77/img.jpg',
            sha256: 'sha',
            usefulnessScore: 0.75,
            reasonCodes: ['NO_GLOBAL'],
            nearDupImageId: 'dup-1',
            createdAt,
          },
          {
            id: 'suggest-2',
            equipmentId: 88,
            gymImageId: 'gym-img-2',
            storageKey: 'private/global/candidates/88/img.jpg',
            sha256: 'sha2',
            usefulnessScore: 0.25,
            reasonCodes: [],
            nearDupImageId: null,
            createdAt: later,
          },
        ]),
      },
      equipment: {
        findMany: jest.fn().mockResolvedValue([{ id: 77, name: 'Cable Row' }]),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    const result = await svc.listGlobalSuggestions({ limit: 1 }, createCtx());

    expect(prisma.globalImageSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2, skip: 0, cursor: undefined }),
    );
    expect(prisma.equipment.findMany).toHaveBeenCalledWith({
      where: { id: { in: [77] } },
      select: { id: true, name: true },
    });
    expect(result.items).toEqual([
      {
        id: 'suggest-1',
        equipmentId: 77,
        equipment: { id: 77, name: 'Cable Row' },
        gymImageId: 'gym-img-1',
        storageKey: 'private/global/candidates/77/img.jpg',
        sha256: 'sha',
        usefulnessScore: 0.75,
        reasonCodes: ['NO_GLOBAL'],
        nearDupImageId: 'dup-1',
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(result.nextCursor).toBe('suggest-2');
  });

  it('requires admin privileges', async () => {
    const prisma = {
      globalImageSuggestion: { findMany: jest.fn() },
      equipment: { findMany: jest.fn() },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    await expect(
      svc.listGlobalSuggestions({}, createCtx({ appRole: AppRole.MODERATOR })),
    ).rejects.toThrow('Forbidden');
  });
});

describe('approveGlobalSuggestion', () => {
  const ctx = createCtx();

  function createSuggestion(overrides: Partial<any> = {}, gymImageOverrides: Partial<any> = {}) {
    const { gymImage: nestedOverrides, ...rest } = overrides as any;
    return {
      id: 'suggest-1',
      equipmentId: 55,
      gymImageId: 'gym-img-1',
      storageKey: 'private/global/candidates/55/sha-1.jpg',
      sha256: 'sha-1',
      status: 'PENDING',
      ...rest,
      gymImage: {
        capturedByUserId: 9,
        approvedByUserId: null,
        angleId: null,
        heightId: null,
        lightingId: null,
        mirrorId: null,
        distanceId: null,
        sourceId: null,
        splitId: null,
        hasPerson: false,
        personCount: 0,
        personBoxes: null,
        modelVendor: 'vendor',
        modelName: 'model',
        modelVersion: '1.0',
        ...(nestedOverrides ?? {}),
        ...gymImageOverrides,
      },
    };
  }

  it('creates global image when suggestion is unique', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-05-01T00:00:00.000Z'));
    const suggestion = createSuggestion();
    const tx = {
      equipmentImage: {
        create: jest.fn().mockResolvedValue({ id: 'equip-1' }),
      },
      globalImageSuggestion: {
        update: jest.fn().mockResolvedValue({}),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      globalImageSuggestion: {
        findUnique: jest.fn().mockResolvedValue(suggestion),
      },
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ v: '[0.5,0.75]' }]),
      $transaction: jest.fn((fn: any) => fn(tx)),
    } as unknown as PrismaClient;

    try {
      const svc = new ImagePromotionService(prisma);
      const result = await svc.approveGlobalSuggestion({ id: 'suggest-1' } as any, ctx);

      expect(prisma.globalImageSuggestion.findUnique).toHaveBeenCalledWith({
        where: { id: 'suggest-1' },
        include: { gymImage: true },
      });
      expect(tx.equipmentImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          equipmentId: 55,
          storageKey: expect.stringContaining('private/global/approved/55/2025/05/sha-1.jpg'),
          sha256: 'sha-1',
        }),
      });
      expect(writeImageEmbeddingMock).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'GLOBAL', imageId: 'equip-1' }),
      );
      expect(result.storageKey).toContain('private/global/approved/55/2025/05/sha-1.jpg');
      expect(result).toEqual({ approved: true, imageId: 'equip-1', storageKey: result.storageKey });
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns existing global image when duplicate sha is found', async () => {
    const suggestion = createSuggestion();
    const prisma = {
      globalImageSuggestion: {
        findUnique: jest.fn().mockResolvedValue(suggestion),
        update: jest.fn().mockResolvedValue({}),
      },
      equipmentImage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'existing',
          storageKey: 'private/global/approved/55/2024/01/sha-1.jpg',
        }),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    const result = await svc.approveGlobalSuggestion({ id: 'suggest-1' } as any, ctx);

    expect(prisma.globalImageSuggestion.update).toHaveBeenCalledWith({
      where: { id: 'suggest-1' },
      data: { status: 'APPROVED' },
    });
    expect(result).toEqual({
      approved: true,
      imageId: 'existing',
      storageKey: 'private/global/approved/55/2024/01/sha-1.jpg',
    });
  });
});

describe('global suggestion moderation', () => {
  it('rejects a suggestion and records the reason', async () => {
    const prisma = {
      globalImageSuggestion: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

    const svc = new ImagePromotionService(prisma);
    const res = await svc.rejectGlobalSuggestion(
      { id: 'suggest-1', reason: 'duplicate' } as any,
      createCtx(),
    );

    expect(prisma.globalImageSuggestion.update).toHaveBeenCalledWith({
      where: { id: 'suggest-1' },
      data: { status: 'REJECTED', rejectedReason: 'duplicate' },
    });
    expect(res).toEqual({ rejected: true });
  });
});
