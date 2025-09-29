// This suite relies heavily on Jest's runtime mock typings and manual mocks.
// The tests exercise behavior through the mocked interfaces without importing
// the real implementations, so we construct lightweight helper types inline.
import { jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';

type AsyncMock<Result = void, Args extends any[] = []> = MockedFunction<
  (...args: Args) => Promise<Result>
>;

type GetObjectResponse = {
  Body: { transformToByteArray: () => Promise<Uint8Array> };
};

const mockTransformToByteArray: AsyncMock<Uint8Array> = jest.fn<() => Promise<Uint8Array>>();
const mockSend: AsyncMock<GetObjectResponse, [unknown]> =
  jest.fn<(command: unknown) => Promise<GetObjectResponse>>();
mockSend.mockResolvedValue({ Body: { transformToByteArray: mockTransformToByteArray } });

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn().mockImplementation((args) => args),
}));

const mockSafetyCheck: AsyncMock<{ nsfwScore: number }, [unknown]> =
  jest.fn<(input: unknown) => Promise<{ nsfwScore: number }>>();
jest.mock('../../../src/modules/images/safety', () => ({
  createSafetyProvider: jest.fn(() => ({ check: mockSafetyCheck })),
}));

const mockHasPerson: AsyncMock<boolean, [Buffer | Uint8Array]> =
  jest.fn<(buffer: Buffer | Uint8Array) => Promise<boolean>>();
jest.mock('../../../src/modules/images/safety/local-person', () => ({
  hasPerson: mockHasPerson,
}));

const mockInitLocalOpenCLIP: AsyncMock<void> = jest.fn<() => Promise<void>>();
const mockEmbedImage: AsyncMock<Float32Array, [string]> =
  jest.fn<(key: string) => Promise<Float32Array>>();
jest.mock('../../../src/modules/images/embedding/local-openclip-light', () => ({
  initLocalOpenCLIP: mockInitLocalOpenCLIP,
  embedImage: mockEmbedImage,
}));

const mockCopyObjectIfMissing: AsyncMock<void, [string, string]> =
  jest.fn<(source: string, destination: string) => Promise<void>>();
const mockDeleteObjectIgnoreMissing: AsyncMock<void, [string]> =
  jest.fn<(key: string) => Promise<void>>();
jest.mock('../../../src/modules/media/media.service', () => ({
  copyObjectIfMissing: mockCopyObjectIfMissing,
  deleteObjectIgnoreMissing: mockDeleteObjectIgnoreMissing,
}));

const mockWriteImageEmbedding: AsyncMock<void, [unknown]> =
  jest.fn<(payload: unknown) => Promise<void>>();
jest.mock('../../../src/modules/cv/embeddingWriter', () => ({
  writeImageEmbedding: mockWriteImageEmbedding,
}));

const mockUserIsTrustedForGym: AsyncMock<boolean, [string, string]> =
  jest.fn<(userId: string, gymId: string) => Promise<boolean>>();
jest.mock('../../../src/modules/gym/permission-helpers', () => ({
  userIsTrustedForGym: mockUserIsTrustedForGym,
}));

const mockClaimBatch: AsyncMock<any[], [number?]> = jest.fn<(limit?: number) => Promise<any[]>>();
const mockMarkDone: AsyncMock<void, [number]> = jest.fn<(id: number) => Promise<void>>();
const mockMarkFailed: AsyncMock<void, [number, unknown, number?]> =
  jest.fn<(id: number, error: unknown, delay?: number) => Promise<void>>();
const mockTryAcquireLease: AsyncMock<boolean> = jest.fn<() => Promise<boolean>>();
const mockRenewLease: AsyncMock<void> = jest.fn<() => Promise<void>>();
const mockReleaseLease: AsyncMock<void> = jest.fn<() => Promise<void>>();

const mockQueue = {
  claimBatch: mockClaimBatch,
  markDone: mockMarkDone,
  markFailed: mockMarkFailed,
  tryAcquireLease: mockTryAcquireLease,
  renewLease: mockRenewLease,
  releaseLease: mockReleaseLease,
} as const;

jest.mock('../../../src/modules/images/queue-runner.service', () => ({
  QueueRunnerService: jest.fn(() => mockQueue),
}));

function buildPrismaMocks() {
  return {
    gymEquipmentImage: {
      updateMany: jest.fn<(args: unknown) => Promise<void>>(),
      findFirst: jest.fn<(args: unknown) => Promise<unknown | null>>(),
      findUnique: jest.fn<(args: unknown) => Promise<unknown | null>>(),
    },
    trainingCandidate: {
      updateMany: jest.fn<(args: unknown) => Promise<void>>(),
      findFirst: jest.fn<(args: unknown) => Promise<unknown | null>>(),
      update: jest.fn<(args: unknown) => Promise<void>>(),
    },
    equipmentImage: {
      findFirst: jest.fn<(args: unknown) => Promise<unknown | null>>(),
      findUnique: jest.fn<(args: unknown) => Promise<unknown | null>>(),
      count: jest.fn<(args: unknown) => Promise<number>>(),
    },
    imageQueue: {
      create: jest.fn<(args: unknown) => Promise<void>>(),
      update: jest.fn<(args: unknown) => Promise<void>>(),
    },
    globalImageSuggestion: {
      upsert: jest.fn<(args: unknown) => Promise<void>>(),
    },
    gym: {
      findUnique: jest.fn<(args: unknown) => Promise<unknown | null>>(),
    },
    $executeRawUnsafe: jest.fn<(...args: any[]) => Promise<unknown>>(),
  } as const;
}

const prismaMocks = buildPrismaMocks();

jest.mock('../../../src/prisma', () => ({
  prisma: prismaMocks,
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
  prismaMocks.gymEquipmentImage.updateMany.mockReset();
  prismaMocks.gymEquipmentImage.findFirst.mockReset();
  prismaMocks.gymEquipmentImage.findUnique.mockReset();
  prismaMocks.trainingCandidate.updateMany.mockReset();
  prismaMocks.trainingCandidate.findFirst.mockReset();
  prismaMocks.trainingCandidate.update.mockReset();
  prismaMocks.equipmentImage.findFirst.mockReset();
  prismaMocks.equipmentImage.findUnique.mockReset();
  prismaMocks.equipmentImage.count.mockReset();
  prismaMocks.imageQueue.create.mockReset();
  prismaMocks.imageQueue.update.mockReset();
  prismaMocks.gym.findUnique.mockReset();
  prismaMocks.globalImageSuggestion.upsert.mockReset();
  prismaMocks.$executeRawUnsafe.mockReset();

  prismaMocks.gymEquipmentImage.updateMany.mockResolvedValue(undefined);
  prismaMocks.gymEquipmentImage.findFirst.mockResolvedValue(null);
  prismaMocks.gymEquipmentImage.findUnique.mockResolvedValue(null);
  prismaMocks.trainingCandidate.updateMany.mockResolvedValue(undefined);
  prismaMocks.trainingCandidate.findFirst.mockResolvedValue(null);
  prismaMocks.trainingCandidate.update.mockResolvedValue(undefined);
  prismaMocks.equipmentImage.findFirst.mockResolvedValue(null);
  prismaMocks.equipmentImage.findUnique.mockResolvedValue(null);
  prismaMocks.equipmentImage.count.mockResolvedValue(0);
  prismaMocks.imageQueue.create.mockResolvedValue(undefined);
  prismaMocks.imageQueue.update.mockResolvedValue(undefined);
  prismaMocks.gym.findUnique.mockResolvedValue(null);
  prismaMocks.globalImageSuggestion.upsert.mockResolvedValue(undefined);
  prismaMocks.$executeRawUnsafe.mockResolvedValue(undefined);
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
    expect(prismaMocks.imageQueue.create).toHaveBeenCalledWith(
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

  it('records hashes for non-candidate uploads without moving files', async () => {
    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 21,
        jobType: 'HASH',
        storageKey: 'public/gym/photo.jpg',
        priority: 0,
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(mockCopyObjectIfMissing).not.toHaveBeenCalled();
    expect(mockDeleteObjectIgnoreMissing).not.toHaveBeenCalled();
    expect(prismaMocks.trainingCandidate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageKey: 'public/gym/photo.jpg',
          OR: [{ hash: null }, { hash: '' }],
        }),
        data: { hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      }),
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(21);
  });

  it('quarantines unsafe images and falls back when status update fails', async () => {
    mockSafetyCheck.mockResolvedValue({ nsfwScore: 0.95 });
    mockHasPerson.mockResolvedValue(true);
    prismaMocks.gymEquipmentImage.updateMany
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
    expect(prismaMocks.trainingCandidate.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { storageKey: 'private/gym/9/candidates/photo.jpg' },
        data: expect.objectContaining({ status: 'quarantined', hasPerson: true }),
      }),
    );
    expect(prismaMocks.trainingCandidate.updateMany).toHaveBeenNthCalledWith(
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
    expect(prismaMocks.imageQueue.create).not.toHaveBeenCalled();
  });

  it('enqueues embedding jobs for safe images', async () => {
    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 4,
        jobType: 'SAFETY',
        storageKey: 'private/gym/1/candidates/safe.jpg',
        priority: 2,
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(prismaMocks.imageQueue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobType: 'EMBED',
          storageKey: 'private/gym/1/candidates/safe.jpg',
          priority: 2,
        }),
      }),
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(4);
  });

  it('writes embeddings for fresh training candidates', async () => {
    mockEmbedImage.mockResolvedValue(Float32Array.from([3, 4]));
    prismaMocks.trainingCandidate.findFirst.mockResolvedValue({
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
    const [[sql, vector, ...rest]] = prismaMocks.$executeRawUnsafe.mock.calls;
    expect(sql).toContain('UPDATE "TrainingCandidate"');
    expect(vector).toHaveLength(2);
    expect(vector[0]).toBeCloseTo(0.6, 5);
    expect(vector[1]).toBeCloseTo(0.8, 5);
    expect(rest).toEqual([42, 'vendor', 'model', 'version']);
    expect(mockQueue.markDone).toHaveBeenCalledWith(3);
    expect(prismaMocks.imageQueue.create).not.toHaveBeenCalled();
  });

  it('approves trusted gym uploads when auto-approve is enabled', async () => {
    mockEmbedImage.mockResolvedValue(Float32Array.from([0, 2]));
    prismaMocks.trainingCandidate.findFirst.mockResolvedValue({
      id: 'tc-1',
      gymId: 'gym-9',
      uploaderUserId: 'user-7',
      imageId: 'img-4',
    });
    prismaMocks.gymEquipmentImage.findFirst.mockResolvedValue({
      id: 'img-4',
      gymId: 'gym-9',
    });
    prismaMocks.gym.findUnique.mockResolvedValue({ autoApproveManagerUploads: true });
    mockUserIsTrustedForGym.mockResolvedValue(true);

    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 5,
        jobType: 'EMBED',
        storageKey: 'private/gym/9/images/pic.jpg',
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(mockUserIsTrustedForGym).toHaveBeenCalledWith('user-7', 'gym-9');
    expect(prismaMocks.trainingCandidate.update).toHaveBeenCalledWith({
      where: { id: 'tc-1' },
      data: { status: 'approved' },
    });
    expect(prismaMocks.gymEquipmentImage.updateMany).toHaveBeenCalledWith({
      where: { id: 'img-4' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedByUserId: 'user-7',
      }),
    });
    expect(mockWriteImageEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'GYM', imageId: 'img-4', gymId: 'gym-9' }),
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(5);
  });

  it('writes embeddings for equipment images discovered via lookup', async () => {
    mockEmbedImage.mockResolvedValue(Float32Array.from([1, 1, 1]));
    prismaMocks.equipmentImage.findUnique.mockResolvedValueOnce({
      storageKey: 'global/eq/img.jpg',
    });
    prismaMocks.equipmentImage.findFirst.mockResolvedValueOnce({ id: 'eq-11' });

    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 6,
        jobType: 'EMBED',
        imageId: 'eq-11',
        storageKey: null,
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(prismaMocks.equipmentImage.findUnique).toHaveBeenCalledWith({
      where: { id: 'eq-11' },
      select: { storageKey: true },
    });
    expect(prismaMocks.equipmentImage.findFirst).toHaveBeenCalledWith({
      where: { storageKey: 'global/eq/img.jpg' },
      select: { id: true },
    });
    expect(mockWriteImageEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'GLOBAL', imageId: 'eq-11' }),
    );
    expect(mockQueue.markDone).toHaveBeenCalledWith(6);
  });

  it('retries transient errors for hash jobs when under the retry limit', async () => {
    const err = new Error('temporary-r2-failure');
    mockTransformToByteArray.mockRejectedValueOnce(err);
    mockQueue.claimBatch.mockResolvedValueOnce([
      {
        id: 22,
        jobType: 'HASH',
        storageKey: 'private/gym/1/candidates/flaky.jpg',
        attempts: 0,
      },
    ] as any);

    const worker = await importWorker();
    await worker.processOnce();

    expect(mockQueue.markFailed).toHaveBeenCalledWith(22, err, 30);
    expect(prismaMocks.imageQueue.update).not.toHaveBeenCalled();
    expect(mockQueue.markDone).not.toHaveBeenCalled();
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

    expect(prismaMocks.imageQueue.update).toHaveBeenCalledWith(
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
      .mockResolvedValueOnce([{ id: 55, jobType: 'unknown', storageKey: 'k', attempts: 1 } as any])
      .mockResolvedValueOnce([]);

    const worker = await importWorker();

    await worker.kickBurstRunner({
      idleExitMs: 0,
      batchSize: 1,
      leaseTtlMs: 1000,
      maxRuntimeMs: 1000,
    });

    expect(mockQueue.tryAcquireLease).toHaveBeenCalledTimes(1);
    expect(mockQueue.markFailed).toHaveBeenCalledWith(55, expect.any(Error), 7);
    expect(mockQueue.releaseLease).toHaveBeenCalledTimes(1);
  });
});
