import {
  knnSearchService,
  knnFromVectorGlobal,
  knnFromVectorGym,
} from '../../../src/modules/cv/knn.service';
import { prisma } from '../../../src/prisma';

jest.mock('../../../src/prisma', () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));

const queryRawUnsafeMock = prisma.$queryRawUnsafe as jest.MockedFunction<
  typeof prisma.$queryRawUnsafe
>;

type Row = { id: string; equipmentId: number | null; score: number; storageKey: string };

describe('knn.service', () => {
  beforeEach(() => {
    queryRawUnsafeMock.mockReset();
  });

  it('performs a global search and clamps limit', async () => {
    const rows: Row[] = [
      { id: 'a', equipmentId: 1, score: 0.9, storageKey: 'g/a' },
      { id: 'b', equipmentId: null, score: 0.8, storageKey: 'g/b' },
    ];
    queryRawUnsafeMock.mockResolvedValue(rows);

    const result = await knnSearchService({ imageId: 'img-1', scope: 'GLOBAL', limit: 500 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    const [sql, sourceId, excludeId, limit] = queryRawUnsafeMock.mock.calls[0];
    expect(sql).toContain('FROM "EquipmentImage" ei');
    expect(sourceId).toBe('img-1');
    expect(excludeId).toBe('img-1');
    expect(limit).toBe(100);
    expect(result).toBe(rows);
  });

  it('requires gymId for gym scope', async () => {
    await expect(knnSearchService({ imageId: 'img-2', scope: 'GYM' } as any)).rejects.toThrow(
      /gymId is required/,
    );
  });

  it('queries gym scope when requested', async () => {
    const rows: Row[] = [{ id: 'gym', equipmentId: 3, score: 0.7, storageKey: 'gym/1' }];
    queryRawUnsafeMock.mockResolvedValue(rows);

    const result = await knnSearchService({ imageId: 'img-3', scope: 'GYM', gymId: 42, limit: 0 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    const [sql, sourceId, gymId, excludeId, limit] = queryRawUnsafeMock.mock.calls[0];
    expect(sql).toContain('FROM "GymEquipmentImage" ge');
    expect(sourceId).toBe('img-3');
    expect(gymId).toBe(42);
    expect(excludeId).toBe('img-3');
    expect(limit).toBe(1);
    expect(result).toBe(rows);
  });

  it('falls back to gym search when auto results below threshold', async () => {
    const globalRows: Row[] = [{ id: 'global', equipmentId: 1, score: 0.5, storageKey: 'g/1' }];
    const gymRows: Row[] = [{ id: 'gym', equipmentId: 2, score: 0.8, storageKey: 'gym/1' }];
    queryRawUnsafeMock.mockResolvedValueOnce(globalRows).mockResolvedValueOnce(gymRows);

    const result = await knnSearchService({ imageId: 'img-4', scope: 'AUTO', gymId: 7, limit: 3 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(2);
    expect(queryRawUnsafeMock.mock.calls[0][0]).toContain('FROM "EquipmentImage" ei');
    expect(queryRawUnsafeMock.mock.calls[1][0]).toContain('FROM "GymEquipmentImage" ge');
    expect(result).toBe(gymRows);
  });

  it('respects minScore clamp when provided', async () => {
    const globalRows: Row[] = [{ id: 'global', equipmentId: 1, score: 0.05, storageKey: 'g/2' }];
    queryRawUnsafeMock.mockResolvedValue(globalRows);

    const result = await knnSearchService({
      imageId: 'img-5',
      scope: 'AUTO',
      gymId: 9,
      minScore: -1,
    });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(globalRows);
  });

  it('queries by vector globally with optional gym filter', async () => {
    const rows: Row[] = [{ id: 'vec', equipmentId: 4, score: 0.99, storageKey: 'vec/1' }];
    queryRawUnsafeMock.mockResolvedValue(rows);

    const result = await knnFromVectorGlobal({ vector: [1, 0], limit: 250, gymId: 11 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    const [sql, vectorParam, limit] = queryRawUnsafeMock.mock.calls[0];
    expect(sql).toContain('GymEquipment');
    expect(sql).toContain('ge."gymId" = 11');
    expect(vectorParam).toEqual([1, 0]);
    expect(limit).toBe(100);
    expect(result).toBe(rows);
  });

  it('queries by vector for a gym', async () => {
    const rows: Row[] = [{ id: 'gym-vec', equipmentId: 5, score: 0.77, storageKey: 'gym/vec' }];
    queryRawUnsafeMock.mockResolvedValue(rows);

    const result = await knnFromVectorGym({ vector: [0.5, 0.5], gymId: 21, limit: 0 });

    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    const [sql, vectorParam, gymId, limit] = queryRawUnsafeMock.mock.calls[0];
    expect(sql).toContain('FROM "GymEquipmentImage" ge');
    expect(vectorParam).toEqual([0.5, 0.5]);
    expect(gymId).toBe(21);
    expect(limit).toBe(1);
    expect(result).toBe(rows);
  });
});
