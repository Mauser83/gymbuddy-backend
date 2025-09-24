jest.mock('../../../src/modules/images/image-worker.js', () => ({
  // Provide a Promise to avoid errors when tests call .catch on the result
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/prisma', () => ({
  ImageJobStatus: { pending: 'PENDING' },
}));

jest.mock('../../../src/modules/media/media.service', () => ({
  copyObjectIfMissing: jest.fn().mockResolvedValue(undefined),
  deleteObjectIgnoreMissing: jest.fn().mockResolvedValue(undefined),
}));

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

import { ImageIntakeService } from '../../../src/modules/images/image-intake.service';
import type { FinalizeGymImagesDto } from '../../../src/modules/images/images.dto';
import {
  copyObjectIfMissing,
  deleteObjectIgnoreMissing,
} from '../../../src/modules/media/media.service';
import type { PrismaClient } from '../../../src/prisma';

// Mock the S3 client's send method so no real network calls are made during tests
const s3SendMock = jest.spyOn(S3Client.prototype, 'send');
const copyMock = jest.mocked(copyObjectIfMissing);
const deleteMock = jest.mocked(deleteObjectIgnoreMissing);

const DEFAULT_UPLOAD_STORAGE_KEY =
  'private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg';

function createFinalizeInput(overrides: Partial<FinalizeGymImagesDto> = {}): FinalizeGymImagesDto {
  const defaults = {
    gymId: 1,
    equipmentId: 2,
    ...(overrides.defaults ?? {}),
  };

  const items: FinalizeGymImagesDto['items'] = overrides.items?.map((item) => ({ ...item })) ?? [
    {
      storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
    },
  ];

  const input: FinalizeGymImagesDto = {
    defaults,
    items,
  };

  if (overrides.sessionId !== undefined) {
    input.sessionId = overrides.sessionId;
  }

  return input;
}

beforeEach(() => {
  copyMock.mockClear();
  deleteMock.mockClear();
  s3SendMock.mockImplementation(async (cmd: unknown) => {
    if (cmd instanceof HeadObjectCommand) {
      return { ContentType: 'image/jpeg', ContentLength: 12345 } as any;
    }
    return {} as any;
  });
});

function createTaxonomyPrismaMock(overrides?: Partial<Record<string, any>>) {
  const base = {
    sourceType: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
    splitType: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
    angleType: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
    heightType: { findFirst: jest.fn().mockResolvedValue({ id: 4 }) },
    distanceType: { findFirst: jest.fn().mockResolvedValue({ id: 5 }) },
    lightingType: { findFirst: jest.fn().mockResolvedValue({ id: 6 }) },
    mirrorType: { findFirst: jest.fn().mockResolvedValue({ id: 7 }) },
  } as const;
  return { ...base, ...(overrides ?? {}) } as any;
}

afterEach(() => {
  s3SendMock.mockReset();
});

afterAll(() => {
  s3SendMock.mockRestore();
});

function createPrismaMock() {
  const image = {
    id: 'cuid1',
    gymId: 1,
    equipmentId: 2,
    storageKey: 'private/uploads/1/2025/01/u.jpg',
    status: 'PENDING',
  };

  return {
    gymEquipment: {
      upsert: jest.fn().mockResolvedValue({ id: 1 }),
    },
    gymEquipmentImage: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(image),
      update: jest.fn().mockImplementation(({ data }) => ({ ...image, ...data })),
    },
    imageQueue: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient;
}

describe('finalizeGymImage', () => {
  it('creates DB row and enqueues jobs', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const out = await svc.finalizeGymImage({
      storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
      gymId: 1,
      equipmentId: 2,
    } as any);
    expect(out.image.id).toBe('cuid1');
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalled();
    expect(prisma.imageQueue.createMany).toHaveBeenCalled();
    expect(out.queuedJobs).toEqual(['HASH']);
  });

  it('omits HASH when sha256 provided', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const out = await svc.finalizeGymImage({
      storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
      gymId: 1,
      equipmentId: 2,
      sha256: 'deadbeef',
    } as any);
    expect(out.queuedJobs).toEqual([]);
    expect(prisma.imageQueue.createMany).not.toHaveBeenCalled();
  });

  it('rejects mismatched gymId ↔ storageKey', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    await expect(
      svc.finalizeGymImage({
        storageKey: 'private/uploads/99/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
        gymId: 1,
        equipmentId: 2,
      } as any),
    ).rejects.toThrow(/does not match/i);
  });

  it('is idempotent on repeated finalize', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const input = {
      storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
      gymId: 1,
      equipmentId: 2,
      sha256: 'deadbeef',
    } as any;
    await svc.finalizeGymImage(input);
    const existing = {
      id: 'cuid1',
      gymId: 1,
      equipmentId: 2,
      storageKey: 'approved/key.jpg',
      status: 'PENDING',
    };
    (prisma.gymEquipmentImage.findFirst as any).mockResolvedValue(existing);
    const out = await svc.finalizeGymImage(input);
    expect(out.image.id).toBe('cuid1');
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalledTimes(1);
  });

  it('throws when uploaded object is missing', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    s3SendMock.mockImplementationOnce(async () => {
      const err: any = new Error('not found');
      err.$metadata = { httpStatusCode: 404 };
      throw err;
    });
    await expect(
      svc.finalizeGymImage({
        storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
        gymId: 1,
        equipmentId: 2,
      } as any),
    ).rejects.toThrow(/Uploaded object not found/);
    expect(prisma.gymEquipmentImage.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported content types', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    s3SendMock.mockImplementationOnce(
      async () =>
        ({
          ContentType: 'text/plain',
          ContentLength: 123,
        }) as any,
    );
    await expect(
      svc.finalizeGymImage({
        storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
        gymId: 1,
        equipmentId: 2,
      } as any),
    ).rejects.toThrow(/Unsupported contentType/);
    expect(prisma.gymEquipmentImage.create).not.toHaveBeenCalled();
  });

  it('rejects zero-length uploads', async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    s3SendMock.mockImplementationOnce(
      async () =>
        ({
          ContentType: 'image/jpeg',
          ContentLength: 0,
        }) as any,
    );
    await expect(
      svc.finalizeGymImage({
        storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
        gymId: 1,
        equipmentId: 2,
      } as any),
    ).rejects.toThrow(/Object size invalid or zero/);
    expect(prisma.gymEquipmentImage.create).not.toHaveBeenCalled();
  });
});

describe('finalizeGymImagesAdmin', () => {
  function createAdminPrismaMock() {
    const prisma: any = {
      gymEquipment: { upsert: jest.fn().mockResolvedValue({ id: 1 }) },
      gymEquipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data, select }) => {
          const image = { id: 'cuid1', ...data };
          if (select) {
            const out: any = {};
            for (const k of Object.keys(select)) if ((select as any)[k]) out[k] = (image as any)[k];
            return out;
          }
          return image;
        }),
      },
      imageQueue: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    return prisma as unknown as PrismaClient;
  }

  it('returns storageKey for each finalized image', async () => {
    const prisma = createAdminPrismaMock();
    const svc = new ImageIntakeService(prisma);
    (svc as any).getDefaultTaxonomyIds = jest.fn().mockResolvedValue({
      sourceId: 1,
      splitId: 1,
      angleId: 1,
      heightId: 1,
      distanceId: 1,
      lightingId: 1,
      mirrorId: 1,
    });
    const out = await svc.finalizeGymImagesAdmin(
      {
        defaults: { gymId: 1, equipmentId: 2 },
        items: [
          {
            storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
          },
        ],
      },
      null,
    );
    expect(out.images[0].storageKey).toBeDefined();
  });
});

describe('finalizeGymImages', () => {
  function createFinalizePrismaMock(overrides?: Partial<Record<string, any>>) {
    const taxonomy = createTaxonomyPrismaMock();
    const prisma: any = {
      ...taxonomy,
      gymEquipment: { upsert: jest.fn().mockResolvedValue({ id: 42 }) },
      gymEquipmentImage: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'new-image', ...data })),
      },
      imageQueue: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      ...overrides,
    };
    return prisma as PrismaClient;
  }

  it('copies upload to approved path and enqueues hash job', async () => {
    const prisma = createFinalizePrismaMock();
    const svc = new ImageIntakeService(prisma);

    const res = await svc.finalizeGymImages(createFinalizeInput(), 123);

    expect(copyMock).toHaveBeenCalledWith(
      DEFAULT_UPLOAD_STORAGE_KEY,
      expect.stringContaining('private/gym/42/approved/'),
    );
    expect(deleteMock).toHaveBeenCalledWith(DEFAULT_UPLOAD_STORAGE_KEY);
    expect(prisma.imageQueue.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          jobType: 'HASH',
          storageKey: expect.stringContaining('private/gym/42/approved/'),
        }),
      ],
    });
    expect(res.queuedJobs).toBe(1);
    expect(res.images).toHaveLength(1);
  });

  it('returns existing image without touching storage when duplicate detected', async () => {
    const existing = { id: 'existing-id', storageKey: 'private/gym/42/approved/existing.jpg' };
    const prisma = createFinalizePrismaMock({
      gymEquipmentImage: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    });
    const svc = new ImageIntakeService(prisma);

    const res = await svc.finalizeGymImages(createFinalizeInput(), 123);

    expect(res.images[0]).toEqual(existing);
    expect(res.queuedJobs).toBe(0);
    expect(prisma.gymEquipmentImage.create).not.toHaveBeenCalled();
    expect(copyMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it('rejects uploads with unsupported content type', async () => {
    const prisma = createFinalizePrismaMock();
    const svc = new ImageIntakeService(prisma);
    s3SendMock.mockImplementationOnce(
      async () =>
        ({
          ContentType: 'text/plain',
          ContentLength: 123,
        }) as any,
    );

    await expect(svc.finalizeGymImages(createFinalizeInput(), 123)).rejects.toThrow(
      /Unsupported contentType/,
    );
    expect(copyMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('skips hashing job when sha256 already provided', async () => {
    const prisma = createFinalizePrismaMock();
    const svc = new ImageIntakeService(prisma);
    const res = await svc.finalizeGymImages(
      createFinalizeInput({
        items: [
          {
            storageKey: DEFAULT_UPLOAD_STORAGE_KEY,
            sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          },
        ],
      }),
      123,
    );

    expect(res.queuedJobs).toBe(0);
    expect(prisma.imageQueue.createMany).not.toHaveBeenCalled();
    expect(copyMock).toHaveBeenCalled();
  });
});

describe('applyTaxonomiesToGymImages', () => {
  it('updates only provided taxonomy fields', async () => {
    const prisma = {
      gymEquipmentImage: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    } as unknown as PrismaClient;
    const svc = new ImageIntakeService(prisma);

    const res = await svc.applyTaxonomiesToGymImages({
      imageIds: ['a', 'b', 'c'],
      angleId: 10,
      heightId: 20,
      lightingId: 30,
    });

    expect(prisma.gymEquipmentImage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b', 'c'] } },
      data: { angleId: 10, heightId: 20, lightingId: 30 },
    });
    expect(res.updatedCount).toBe(3);
  });
});

describe('default taxonomy lookups', () => {
  it('fetches defaults once and caches the result', async () => {
    const prisma = createTaxonomyPrismaMock();
    const svc = new ImageIntakeService(prisma as unknown as PrismaClient);

    const first = await (svc as any).getDefaultTaxonomyIds();
    expect(first).toEqual({
      sourceId: 1,
      splitId: 2,
      angleId: 3,
      heightId: 4,
      distanceId: 5,
      lightingId: 6,
      mirrorId: 7,
    });

    await (svc as any).getDefaultTaxonomyIds();
    expect(prisma.sourceType.findFirst).toHaveBeenCalledTimes(1);
  });

  it('throws when required defaults are missing', async () => {
    const prisma = createTaxonomyPrismaMock({
      mirrorType: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new ImageIntakeService(prisma as unknown as PrismaClient);
    await expect((svc as any).getDefaultTaxonomyIds()).rejects.toThrow(/mirrorId/);
  });
});
