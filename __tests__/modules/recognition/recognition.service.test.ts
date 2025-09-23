import type { Mock } from 'jest-mock';

const s3SendMock = jest.fn();
const getSignedUrlMock = jest.fn();
const assertSizeWithinLimitMock = jest.fn();
const embedImageMock = jest.fn();
const initLocalOpenCLIPMock = jest.fn();
const knnFromVectorGymMock = jest.fn();
const knnFromVectorGlobalMock = jest.fn();
const priorityFromSourceMock = jest.fn();
const kickBurstRunnerMock = jest.fn();

const prismaMock: any = {
  equipment: { findMany: jest.fn() },
  recognitionAttempt: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  gymEquipment: { findFirst: jest.fn() },
  trainingCandidate: { create: jest.fn() },
  imageQueue: { create: jest.fn() },
} as const;

const commandFactory = (name: string) =>
  class {
    input: any;
    constructor(input: any) {
      this.input = input;
      (this as any).__type = name;
    }
  };

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: s3SendMock })),
  PutObjectCommand: commandFactory('PutObjectCommand'),
  HeadObjectCommand: commandFactory('HeadObjectCommand'),
  GetObjectCommand: commandFactory('GetObjectCommand'),
  CopyObjectCommand: commandFactory('CopyObjectCommand'),
  DeleteObjectCommand: commandFactory('DeleteObjectCommand'),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

jest.mock('../../../src/modules/media/media.utils', () => ({
  assertSizeWithinLimit: assertSizeWithinLimitMock,
}));

jest.mock('../../../src/modules/images/embedding/local-openclip-light', () => ({
  EMBEDDING_DIM: 512,
  initLocalOpenCLIP: initLocalOpenCLIPMock,
  embedImage: embedImageMock,
}));

jest.mock('../../../src/modules/cv/knn.service', () => ({
  knnFromVectorGym: knnFromVectorGymMock,
  knnFromVectorGlobal: knnFromVectorGlobalMock,
}));

jest.mock('../../../src/modules/images/image-worker.js', () => ({
  kickBurstRunner: kickBurstRunnerMock,
}));

jest.mock('../../../src/modules/images/queue.service', () => ({
  priorityFromSource: priorityFromSourceMock,
}));

jest.mock('../../../src/prisma', () => ({
  prisma: prismaMock,
  ImageJobStatus: { pending: 'pending' },
}));

describe('RecognitionService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    s3SendMock.mockReset();
    getSignedUrlMock.mockReset();
    assertSizeWithinLimitMock.mockReset();
    embedImageMock.mockReset();
    initLocalOpenCLIPMock.mockReset();
    knnFromVectorGymMock.mockReset();
    knnFromVectorGlobalMock.mockReset();
    priorityFromSourceMock.mockReset();
    kickBurstRunnerMock.mockReset();
    Object.values(prismaMock).forEach((section: any) => {
      Object.values(section).forEach((mockFn) => {
        (mockFn as jest.Mock).mockReset();
      });
    });

    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      R2_BUCKET: 'test-bucket',
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'ak',
      R2_SECRET_ACCESS_KEY: 'sk',
      TICKET_SECRET: 'secret',
    };

    initLocalOpenCLIPMock.mockReturnValue(Promise.resolve());
    getSignedUrlMock.mockResolvedValue('https://signed.example');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadService = async () => {
    const { RecognitionService } = require('../../../src/modules/recognition/recognition.service');
    return new RecognitionService();
  };

  it('creates upload tickets with inferred metadata and signature', async () => {
    const service = await loadService();

    const before = Date.now();
    const result = await service.createUploadTicket(17, {
      contentLength: 42,
      ext: 'JPG',
      contentType: undefined,
    } as any);

    expect(assertSizeWithinLimitMock).toHaveBeenCalledWith(42);
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(result.putUrl).toBe('https://signed.example');
    expect(result.storageKey).toMatch(
      /^private\/recognition\/17\/\d{4}\/\d{2}\/[-\w]+\.jpg$/,
    );
    expect(Date.parse(result.expiresAt)).toBeGreaterThanOrEqual(before);

    const payload = (service as any).verify(result.ticketToken);
    expect(payload).toMatchObject({ gid: 17, key: result.storageKey, v: 1 });
  });

  it('rejects unsupported image extensions', async () => {
    const service = await loadService();
    await expect(
      service.createUploadTicket(10, {
        contentLength: 10,
        ext: 'gif',
      } as any),
    ).rejects.toThrow('Unsupported image extension');
  });

  it('recognizes images and aggregates gym candidates', async () => {
    embedImageMock.mockResolvedValue(
      Float32Array.from({ length: 512 }, (_, idx) => (idx % 5) + 1),
    );
    knnFromVectorGymMock.mockResolvedValue([
      { id: 'g1', equipmentId: 1, storageKey: 'g1.jpg', score: 0.91 },
      { id: 'g2', equipmentId: 2, storageKey: 'g2.jpg', score: 0.6 },
    ]);
    knnFromVectorGlobalMock.mockResolvedValue([
      { id: 'glob', equipmentId: 3, storageKey: 'glob.jpg', score: 0.5 },
    ]);
    prismaMock.equipment.findMany.mockResolvedValue([
      { id: 1, name: 'Row Machine' },
      { id: 2, name: 'Bench' },
    ]);
    prismaMock.recognitionAttempt.create.mockImplementation(async ({
      data,
    }: {
      data: any;
    }) => ({      id: BigInt(111),
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      ...data,
    }));

    const byteBody = {
      transformToByteArray: jest.fn().mockResolvedValue(Uint8Array.from([1, 2, 3])),
    };
    s3SendMock.mockImplementation(async (cmd) => {
      switch ((cmd as any).__type) {
        case 'HeadObjectCommand':
          return {};
        case 'GetObjectCommand':
          return { Body: byteBody };
        default:
          throw new Error(`unexpected command ${(cmd as any).__type}`);
      }
    });

    const service = await loadService();

    const token = (service as any).sign({ gid: 55, key: 'private/recognition/55/x.jpg' });
    const result = await service.recognizeImage(token, 2);

    expect(byteBody.transformToByteArray).toHaveBeenCalled();
    expect(knnFromVectorGymMock).toHaveBeenCalledWith(
      expect.objectContaining({ gymId: 55, limit: expect.any(Number) }),
    );
    expect(prismaMock.recognitionAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gymId: 55,
        storageKey: 'private/recognition/55/x.jpg',
        decision: 'GYM_ACCEPT',
      }),
    });
    expect(result.equipmentCandidates[0]).toMatchObject({
      equipmentId: 1,
      equipmentName: 'Row Machine',
      source: 'GYM',
    });
    expect(result.attempt.attemptId).toBe('111');
  });

  it('confirms recognition with training consent and enqueues hashing', async () => {
    priorityFromSourceMock.mockReturnValue(77);
    kickBurstRunnerMock.mockResolvedValue(undefined);
    prismaMock.recognitionAttempt.findUnique.mockResolvedValue({
      id: BigInt(222),
      gymId: 9,
      storageKey: 'private/recognition/9/2024/01/example.jpg',
      bestScore: 0.88,
      createdAt: new Date('2024-01-05T00:00:00Z'),
    });
    prismaMock.gymEquipment.findFirst.mockResolvedValue({ id: 44 });
    prismaMock.recognitionAttempt.update.mockResolvedValue({});
    prismaMock.trainingCandidate.create.mockResolvedValue({
      id: 333,
      storageKey: 'private/gym/44/candidates/new.jpg',
    });

    s3SendMock.mockImplementation(async (cmd) => {
      if ((cmd as any).__type === 'CopyObjectCommand') return {};
      throw new Error('unexpected command');
    });

    const service = await loadService();
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation((fn: any) => {
        fn();
        return 0 as any;
      });

    const result = await service.confirmRecognition({
      attemptId: BigInt(222),
      selectedEquipmentId: 44,
      offerForTraining: true,
      uploaderUserId: 12,
    });

    expect(result).toEqual({ saved: true });
    expect(prismaMock.trainingCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gymEquipmentId: 44,
        source: 'user_submission',
        uploaderUserId: 12,
      }),
      select: { id: true, storageKey: true },
    });
    expect(prismaMock.imageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobType: 'HASH',
        priority: 77,
      }),
    });
    expect(immediateSpy).toHaveBeenCalled();
    expect(kickBurstRunnerMock).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 1, maxRuntimeMs: 300_000 }),
    );

    immediateSpy.mockRestore();
  });

  it('throws when attempting to confirm an unknown recognition attempt', async () => {
    prismaMock.recognitionAttempt.findUnique.mockResolvedValue(null);
    const service = await loadService();
    await expect(
      service.confirmRecognition({
        attemptId: BigInt(5),
        selectedEquipmentId: 1,
        offerForTraining: false,
        uploaderUserId: null,
      }),
    ).rejects.toThrow('Attempt not found');
  });

  it('rejects selection of equipment outside the gym', async () => {
    prismaMock.recognitionAttempt.findUnique.mockResolvedValue({
      id: BigInt(1),
      gymId: 2,
      storageKey: 'key.jpg',
      bestScore: 0.2,
      createdAt: new Date(),
    });
    prismaMock.gymEquipment.findFirst.mockResolvedValue(null);
    const service = await loadService();

    await expect(
      service.confirmRecognition({
        attemptId: BigInt(1),
        selectedEquipmentId: 99,
        offerForTraining: false,
        uploaderUserId: null,
      }),
    ).rejects.toThrow('Selected equipment is not part of this gym');
  });

  it('discards recognition attempts and ignores missing objects', async () => {
    prismaMock.recognitionAttempt.update.mockResolvedValue({ storageKey: 'key.jpg' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    s3SendMock.mockImplementation(async (cmd) => {
      if ((cmd as any).__type === 'DeleteObjectCommand') {
        const error: any = new Error('missing');
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
      throw new Error('unexpected command');
    });

    const service = await loadService();
    const result = await service.discardRecognition(BigInt(77));

    expect(result).toBe(true);
    expect(prismaMock.recognitionAttempt.update).toHaveBeenCalledWith({
      where: { id: BigInt(77) },
      data: { consent: 'denied' },
    });
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
