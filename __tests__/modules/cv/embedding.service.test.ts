import { validateInput } from '../../../src/middlewares/validation';
import {
  GetImageEmbeddingsByImageDto,
  UpsertImageEmbeddingDto,
} from '../../../src/modules/cv/embedding.dto';
import {
  EmbeddingService,
  getLatestEmbeddedImageService,
} from '../../../src/modules/cv/embedding.service';

jest.mock('../../../src/middlewares/validation', () => ({
  validateInput: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/prisma', () => ({
  PrismaClient: class {},
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

const prismaModule = jest.requireMock('../../../src/prisma') as {
  prisma: {
    $queryRawUnsafe: jest.Mock;
  };
};

const queryRawUnsafeMock = prismaModule.prisma.$queryRawUnsafe;

describe('EmbeddingService', () => {
  const createPrismaClientMock = () => ({
    imageEmbedding: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists embeddings for an image scoped when provided', async () => {
    const prismaClient = createPrismaClientMock();
    const service = new EmbeddingService(prismaClient as never);
    const expected = [{ id: 'emb-1' }];
    prismaClient.imageEmbedding.findMany.mockResolvedValueOnce(expected);

    const result = await service.listByImage('img-1', 'GLOBAL');

    expect(validateInput).toHaveBeenCalledWith(
      { imageId: 'img-1', scope: 'GLOBAL' },
      GetImageEmbeddingsByImageDto,
    );
    expect(prismaClient.imageEmbedding.findMany).toHaveBeenCalledWith({
      where: { imageId: 'img-1', scope: 'GLOBAL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toBe(expected);
  });

  it('omits scope filter when not provided', async () => {
    const prismaClient = createPrismaClientMock();
    const service = new EmbeddingService(prismaClient as never);
    prismaClient.imageEmbedding.findMany.mockResolvedValueOnce([]);

    await service.listByImage('img-2');

    expect(validateInput).toHaveBeenCalledWith(
      { imageId: 'img-2', scope: undefined },
      GetImageEmbeddingsByImageDto,
    );
    expect(prismaClient.imageEmbedding.findMany).toHaveBeenCalledWith({
      where: { imageId: 'img-2' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns the latest embedded image for a gym when available', async () => {
    const createdAt = new Date('2024-01-02T00:00:00Z');
    const prismaClient = createPrismaClientMock();
    prismaClient.$queryRaw.mockResolvedValueOnce([{ imageId: 'img-3', createdAt }]);
    const service = new EmbeddingService(prismaClient as never);

    const result = await service.getLatestEmbeddedImage(12);

    expect(prismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ imageId: 'img-3', createdAt });
  });

  it('falls back to null when no embeddings exist for the gym', async () => {
    const prismaClient = createPrismaClientMock();
    prismaClient.$queryRaw.mockResolvedValueOnce([]);
    const service = new EmbeddingService(prismaClient as never);

    const result = await service.getLatestEmbeddedImage();

    expect(result).toBeNull();
  });

  it('upserts an embedding and returns the stored record', async () => {
    const prismaClient = createPrismaClientMock();
    const service = new EmbeddingService(prismaClient as never);
    const record = { id: 'emb-5' };
    prismaClient.imageEmbedding.findUnique.mockResolvedValueOnce(record);

    const input: UpsertImageEmbeddingDto = {
      imageId: 'img-5',
      scope: 'GLOBAL',
      modelVendor: 'openai',
      modelName: 'clip',
      modelVersion: '1',
      dim: 3,
    };

    const result = await service.upsert(input, [0.1, 0.2, 0.3]);

    expect(validateInput).toHaveBeenCalledWith(input, UpsertImageEmbeddingDto);
    expect(prismaClient.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prismaClient.imageEmbedding.findUnique).toHaveBeenCalledWith({
      where: {
        imageId_scope_modelVendor_modelName_modelVersion: {
          imageId: 'img-5',
          scope: 'GLOBAL',
          modelVendor: 'openai',
          modelName: 'clip',
          modelVersion: '1',
        },
      },
    });
    expect(result).toBe(record);
  });

  it('deletes an embedding and returns true', async () => {
    const prismaClient = createPrismaClientMock();
    const service = new EmbeddingService(prismaClient as never);

    const result = await service.delete('emb-9');

    expect(prismaClient.imageEmbedding.delete).toHaveBeenCalledWith({ where: { id: 'emb-9' } });
    expect(result).toBe(true);
  });
});

describe('getLatestEmbeddedImageService', () => {
  beforeEach(() => {
    queryRawUnsafeMock.mockReset();
  });

  it('requires a gymId for gym or auto scopes', async () => {
    await expect(getLatestEmbeddedImageService({ scope: 'GYM' })).rejects.toThrow(
      'gymId is required for this scope',
    );
    await expect(getLatestEmbeddedImageService({ scope: 'AUTO' })).rejects.toThrow(
      'gymId is required for this scope',
    );
  });

  it('returns the latest global embedding with optional equipment filter', async () => {
    const createdAt = new Date('2023-05-01T12:00:00Z');
    queryRawUnsafeMock.mockResolvedValueOnce([{ id: 'global-1', createdAt }]);

    const result = await getLatestEmbeddedImageService({ scope: 'GLOBAL', equipmentId: 77 });

    expect(queryRawUnsafeMock).toHaveBeenCalledWith(
      expect.stringContaining('AND "equipmentId" = 77'),
    );
    expect(result).toEqual({ imageId: 'global-1', createdAt, scope: 'GLOBAL' });
  });

  it('returns the latest gym embedding when scope is GYM', async () => {
    const createdAt = new Date('2023-06-15T08:00:00Z');
    queryRawUnsafeMock.mockResolvedValueOnce([{ id: 'gym-1', createdAt }]);

    const result = await getLatestEmbeddedImageService({ scope: 'GYM', gymId: 5, equipmentId: 9 });

    expect(queryRawUnsafeMock).toHaveBeenCalledWith(expect.stringContaining('AND "gymId" = $1'), 5);
    expect(result).toEqual({ imageId: 'gym-1', createdAt, scope: 'GYM' });
  });

  it('prefers the latest gym embedding when available for AUTO scope', async () => {
    const createdAt = new Date('2023-07-04T10:30:00Z');
    queryRawUnsafeMock.mockResolvedValueOnce([{ id: 'gym-auto', createdAt }]);

    const result = await getLatestEmbeddedImageService({ scope: 'AUTO', gymId: 3, equipmentId: 1 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ imageId: 'gym-auto', createdAt, scope: 'GYM' });
  });

  it('falls back to global embeddings for AUTO scope when no gym match exists', async () => {
    const createdAt = new Date('2023-08-09T18:45:00Z');
    queryRawUnsafeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'global-auto', createdAt }]);

    const result = await getLatestEmbeddedImageService({ scope: 'AUTO', gymId: 8 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(2);
    expect(queryRawUnsafeMock.mock.calls[1][0]).toContain('FROM "EquipmentImage"');
    expect(result).toEqual({ imageId: 'global-auto', createdAt, scope: 'GLOBAL' });
  });

  it('returns null when no embeddings are found for AUTO scope', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getLatestEmbeddedImageService({ scope: 'AUTO', gymId: 11 });

    expect(result).toBeNull();
  });
});
