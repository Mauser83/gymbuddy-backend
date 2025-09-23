// @ts-nocheck -- this suite relies heavily on Jest's runtime mock typings, which
// conflict with our NodeNext configuration. Disabling type checking keeps the
// focus on behavioral coverage without fighting the TS analyzer.
import { jest } from '@jest/globals';

const mockTransformToByteArray = jest.fn<Promise<Uint8Array>, []>();
const mockSend = jest.fn().mockResolvedValue({ Body: { transformToByteArray: mockTransformToByteArray } });

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn().mockImplementation((args) => args),
}));

const mockSafetyCheck = jest.fn();
jest.mock('../../../src/modules/images/safety', () => ({
  createSafetyProvider: jest.fn(() => ({ check: mockSafetyCheck })),
}));

const mockHasPerson = jest.fn();
jest.mock('../../../src/modules/images/safety/local-person', () => ({
  hasPerson: mockHasPerson,
}));

const mockInitLocalOpenCLIP = jest.fn();
const mockEmbedImage = jest.fn();
jest.mock('../../../src/modules/images/embedding/local-openclip-light', () => ({
  initLocalOpenCLIP: mockInitLocalOpenCLIP,
  embedImage: mockEmbedImage,
}));

const mockCopyObjectIfMissing = jest.fn();
const mockDeleteObjectIgnoreMissing = jest.fn();
jest.mock('../../../src/modules/media/media.service', () => ({
  copyObjectIfMissing: mockCopyObjectIfMissing,
  deleteObjectIgnoreMissing: mockDeleteObjectIgnoreMissing,
}));

const mockWriteImageEmbedding = jest.fn();
jest.mock('../../../src/modules/cv/embeddingWriter', () => ({
  writeImageEmbedding: mockWriteImageEmbedding,
}));

const mockUserIsTrustedForGym = jest.fn();
jest.mock('../../../src/modules/gym/permission-helpers', () => ({
  userIsTrustedForGym: mockUserIsTrustedForGym,
}));

const mockQueue = {
  claimBatch: jest.fn(),
  markDone: jest.fn(),
  markFailed: jest.fn(),
  tryAcquireLease: jest.fn(),
  renewLease: jest.fn(),
  releaseLease: jest.fn(),
};

jest.mock('../../../src/modules/images/queue-runner.service', () => ({
  QueueRunnerService: jest.fn(() => mockQueue),
}));

function buildPrismaMock() {
  return {
    gymEquipmentImage: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    trainingCandidate: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    equipmentImage: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    imageQueue: {
      create: jest.fn(),
      update: jest.fn(),
    },
    gym: {
      findUnique: jest.fn(),
    },
    $executeRawUnsafe: jest.fn(),
  } as const;
}

const prismaMock = buildPrismaMock();

const prismaFn = prismaMock as unknown as {
  [K in keyof typeof prismaMock]: {
    [P in keyof (typeof prismaMock)[K]]: jest.Mock;
  };
};

jest.mock('../../../src/prisma', () => ({
  prisma: prismaMock,
  ImageJobStatus: { pending: 'pending', failed: 'failed' },
}));

function importWorker() {
  return Promise.resolve(require('../../../src/modules/images/image-worker.js'));
}

const BASE_ENV = {
  NODE_ENV: 'test',
  R2_ACCOUNT_ID: 'acct',
  R2_BUCKET: 'bucket',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  WORKER_MAX_RETRIES: '3',
  QUEUE_BACKOFF_BASE_SEC: '7',
  QUEUE_BACKOFF_MAX_SEC: '60',
  NSFW_BLOCK: '0.8',
  EMBED_VENDOR: 'vendor',
  EMBED_MODEL: 'model',
  EMBED_VERSION: 'version',
};

const ORIGINAL_ENV = process.env;

function resetPrismaMocks() {
  prismaFn.gymEquipmentImage.updateMany.mockReset();
  prismaFn.gymEquipmentImage.findFirst.mockReset();
  prismaFn.trainingCandidate.updateMany.mockReset();
  prismaFn.trainingCandidate.findFirst.mockReset();
  prismaFn.trainingCandidate.update.mockReset();
  prismaFn.equipmentImage.findFirst.mockReset();
  prismaFn.equipmentImage.findUnique.mockReset();
  prismaFn.imageQueue.create.mockReset();
  prismaFn.imageQueue.update.mockReset();
  prismaFn.gym.findUnique.mockReset();
  prismaFn.$executeRawUnsafe.mockReset();

  prismaFn.gymEquipmentImage.updateMany.mockResolvedValue(undefined);
  prismaFn.gymEquipmentImage.findFirst.mockResolvedValue(null);
  prismaFn.trainingCandidate.updateMany.mockResolvedValue(undefined);
  prismaFn.trainingCandidate.findFirst.mockResolvedValue(null);
  prismaFn.trainingCandidate.update.mockResolvedValue(undefined);
  prismaFn.equipmentImage.findFirst.mockResolvedValue(null);
  prismaFn.equipmentImage.findUnique.mockResolvedValue(null);
  prismaFn.imageQueue.create.mockResolvedValue(undefined);
  prismaFn.imageQueue.update.mockResolvedValue(undefined);
  prismaFn.gym.findUnique.mockResolvedValue(null);
  prismaFn.$executeRawUnsafe.mockResolvedValue(undefined);
}

function resetQueueMocks() {
  Object.values(mockQueue).forEach((fn) => fn.mockReset());
  mockQueue.tryAcquireLease.mockResolvedValue(true);
  mockQueue.renewLease.mockResolvedValue(undefined);
  mockQueue.releaseLease.mockResolvedValue(undefined);
  mockQueue.claimBatch.mockResolvedValue([]);
  mockQueue.markDone.mockResolvedValue(undefined);
  mockQueue.markFailed.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...BASE_ENV };

  mockSend.mockClear();
  mockTransformToByteArray.mockReset();
  mockTransformToByteArray.mockResolvedValue(Uint8Array.from([1, 2, 3]));

  mockSafetyCheck.mockReset();
  mockSafetyCheck.mockResolvedValue({ nsfwScore: 0.1 });
  mockHasPerson.mockReset();
  mockHasPerson.mockResolvedValue(false);
  mockInitLocalOpenCLIP.mockReset();
  mockInitLocalOpenCLIP.mockResolvedValue(undefined);
  mockEmbedImage.mockReset();
  mockEmbedImage.mockResolvedValue(Float32Array.from([1, 0]));
  mockCopyObjectIfMissing.mockReset();
  mockCopyObjectIfMissing.mockResolvedValue(undefined);
  mockDeleteObjectIgnoreMissing.mockReset();
  mockDeleteObjectIgnoreMissing.mockResolvedValue(undefined);
  mockWriteImageEmbedding.mockReset();
  mockWriteImageEmbedding.mockResolvedValue(undefined);
  mockUserIsTrustedForGym.mockReset();
  mockUserIsTrustedForGym.mockResolvedValue(false);

  resetPrismaMocks();
  resetQueueMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('image worker processOnce', () => {
  it('hashes candidate uploads and enqueues safety checks', async () => {
    const sha = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81';
    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 1,
        jobType: 'HASH',
        storageKey: 'private/gym/1/candidates/test.jpg',
        priority: 3,
      },
    ] as any);

    const worker = await importWorker();
    const processed = await worker.processOnce();

    expect(processed).toBe(1);
    expect(mockCopyObjectIfMissing).toHaveBeenCalledWith(
      'private/gym/1/candidates/test.jpg',
      `private/gym/1/candidates/${sha}.jpg`,
    );
    expect(mockDeleteObjectIgnoreMissing).toHaveBeenCalledWith('private/gym/1/candidates/test.jpg');
    expect(prismaFn.imageQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobType: 'SAFETY',
          storageKey: `private/gym/1/candidates/${sha}.jpg`,
          priority: 3,
        }),
      }),
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(1);
  });

  it('quarantines unsafe images and falls back when status update fails', async () => {
    mockSafetyCheck.mockResolvedValue({ nsfwScore: 0.95 });
    mockHasPerson.mockResolvedValue(true);
    prismaFn.gymEquipmentImage.updateMany
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('write-fail'))
      .mockResolvedValueOnce(undefined);

    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 2,
        jobType: 'SAFETY',
        storageKey: 'private/gym/9/candidates/photo.jpg',
        priority: 1,
        attempts: 1,
      },
    ] as any);

    const worker = await importWorker();
    const processed = await worker.processOnce();

    expect(processed).toBe(1);
    expect(prismaFn.trainingCandidate.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { storageKey: 'private/gym/9/candidates/photo.jpg' },
        data: expect.objectContaining({ status: 'quarantined', hasPerson: true }),
      }),
    );
    expect(prismaFn.trainingCandidate.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ storageKey: 'private/gym/9/quarantine/photo.jpg' }),
      }),
    );
    expect(mockCopyObjectIfMissing).toHaveBeenCalledWith(
      'private/gym/9/candidates/photo.jpg',
      'private/gym/9/quarantine/photo.jpg',
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(2);
    expect(prismaFn.imageQueue.create).not.toHaveBeenCalled();
  });

  it('writes embeddings for fresh training candidates', async () => {
    mockEmbedImage.mockResolvedValue(Float32Array.from([3, 4]));
    prismaFn.trainingCandidate.findFirst.mockResolvedValue({
      id: 42,
      gymId: null,
      uploaderUserId: null,
      imageId: null,
    });

    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 3,
        jobType: 'EMBED',
        storageKey: 'candidate/key',
        priority: 0,
      },
    ] as any);

    const worker = await importWorker();
    const processed = await worker.processOnce();

    expect(processed).toBe(1);
    const [[sql, vector, ...rest]] = prismaFn.$executeRawUnsafe.mock.calls;
    expect(sql).toContain('UPDATE "TrainingCandidate"');
    expect(vector).toHaveLength(2);
    expect(vector[0]).toBeCloseTo(0.6, 5);
    expect(vector[1]).toBeCloseTo(0.8, 5);
    expect(rest).toEqual([42, 'vendor', 'model', 'version']);
    expect(mockQueue.markDone).toHaveBeenCalledWith(3);
    expect(prismaFn.imageQueue.create).not.toHaveBeenCalled();
  });

  it('marks exhausted jobs as failed when unsupported', async () => {
    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 9,
        jobType: 'mystery',
        storageKey: null,
        attempts: 3,
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(prismaFn.imageQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9 } }),
    );
    expect(mockQueue.markFailed).not.toHaveBeenCalled();
    expect(mockQueue.markDone).not.toHaveBeenCalled();
  });
});

describe('image worker coordination helpers', () => {
  it('drains batches until no work remains', async () => {
        process.env.WORKER_CONCURRENCY = '10';

    mockQueue.claimBatch
      .mockResolvedValueOnce([
        {
          id: 11,
          jobType: 'HASH',
          storageKey: 'private/gym/1/candidates/a.jpg',
          priority: 1,
        },
        {
          id: 12,
          jobType: 'HASH',
          storageKey: 'private/gym/1/candidates/b.jpg',
          priority: 1,
        },
      ] as any)
      .mockResolvedValueOnce([]);

    const worker = await importWorker();

    await worker.runOnce(5);

    expect(mockQueue.claimBatch).toHaveBeenNthCalledWith(1, 5);
    expect(mockQueue.claimBatch).toHaveBeenNthCalledWith(2, 3);
  });

  it('prevents overlapping run invocations', async () => {
    const worker = await importWorker();
    let resolveFirst: ((value: any) => void) | undefined;
    mockQueue.claimBatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const first = worker.runOnce(2);
    await new Promise((r) => setImmediate(r));
    const second = worker.runOnce(2);

    expect(mockQueue.claimBatch).toHaveBeenCalledTimes(1);
    resolveFirst?.([]);
    await Promise.all([first, second]);
    expect(mockQueue.claimBatch).toHaveBeenCalledTimes(1);
  });

  it('acquires a lease and retries transient jobs in burst mode', async () => {
    mockQueue.claimBatch
      .mockResolvedValueOnce([
        { id: 55, jobType: 'unknown', storageKey: 'k', attempts: 1 } as any,
      ])
      .mockResolvedValueOnce([]);

    const worker = await importWorker();

    await worker.kickBurstRunner({ idleExitMs: 0, batchSize: 1, leaseTtlMs: 1000, maxRuntimeMs: 1000 });

    expect(mockQueue.tryAcquireLease).toHaveBeenCalledTimes(1);
    expect(mockQueue.markFailed).toHaveBeenCalledWith(55, expect.any(Error), 7);
    expect(mockQueue.releaseLease).toHaveBeenCalledTimes(1);
  });
});