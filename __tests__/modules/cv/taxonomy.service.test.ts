import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { TaxonomyService } from '../../../src/modules/cv/taxonomy.service';
import { Prisma, PrismaClient } from '../../../src/prisma';

describe('TaxonomyService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: TaxonomyService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new TaxonomyService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  test('create uses provided displayOrder and trims label', async () => {
    prisma.angleType.create.mockResolvedValue({
      id: 1,
      key: 'k',
      label: 'lbl',
      active: false,
      displayOrder: 7,
    } as any);

    const res = await service.create('ANGLE', {
      key: 'k',
      label: ' lbl ',
      active: false,
      displayOrder: 7,
    });

    expect(prisma.angleType.create).toHaveBeenCalledWith({
      data: {
        key: 'k',
        label: 'lbl',
        description: undefined,
        active: false,
        displayOrder: 7,
      },
    });
    expect(res).toEqual({
      id: 1,
      key: 'k',
      label: 'lbl',
      active: false,
      displayOrder: 7,
      kind: 'ANGLE',
    });
  });

  test('create computes next display order when missing', async () => {
    prisma.angleType.findFirst.mockResolvedValue({ displayOrder: 3 } as any);
    prisma.angleType.create.mockResolvedValue({
      id: 2,
      key: 'k2',
      label: 'lbl2',
      active: true,
      displayOrder: 4,
    } as any);

    const res = await service.create('ANGLE', { key: 'k2', label: 'lbl2' });

    expect(prisma.angleType.findFirst).toHaveBeenCalledWith({
      select: { displayOrder: true },
      orderBy: { displayOrder: 'desc' },
    });
    expect(prisma.angleType.create).toHaveBeenCalledWith({
      data: {
        key: 'k2',
        label: 'lbl2',
        description: undefined,
        active: true,
        displayOrder: 4,
      },
    });
    expect(res).toEqual({
      id: 2,
      key: 'k2',
      label: 'lbl2',
      active: true,
      displayOrder: 4,
      kind: 'ANGLE',
    });
  });

  test('list maps returned rows to include kind and filters by active', async () => {
    const rows = [
      { id: 10, label: 'Low', active: true, displayOrder: 1 },
      { id: 11, label: 'High', active: false, displayOrder: 2 },
    ];
    prisma.distanceType.findMany.mockResolvedValueOnce(rows as any);

    const first = await service.list('DISTANCE', undefined);

    expect(prisma.distanceType.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    expect(first).toEqual([
      { id: 10, label: 'Low', active: true, displayOrder: 1, kind: 'DISTANCE' },
      { id: 11, label: 'High', active: false, displayOrder: 2, kind: 'DISTANCE' },
    ]);

    prisma.distanceType.findMany.mockResolvedValueOnce(rows.slice(0, 1) as any);

    const second = await service.list('DISTANCE', true);

    expect(prisma.distanceType.findMany).toHaveBeenLastCalledWith({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    expect(second).toEqual([
      { id: 10, label: 'Low', active: true, displayOrder: 1, kind: 'DISTANCE' },
    ]);
  });

  test('get returns row with kind or null when missing', async () => {
    prisma.mirrorType.findUnique.mockResolvedValueOnce({
      id: 7,
      label: 'Front',
    } as any);

    await expect(service.get('MIRROR', 7)).resolves.toEqual({
      id: 7,
      label: 'Front',
      kind: 'MIRROR',
    });
    expect(prisma.mirrorType.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });

    prisma.mirrorType.findUnique.mockResolvedValueOnce(null);

    await expect(service.get('MIRROR', 8)).resolves.toBeNull();
    expect(prisma.mirrorType.findUnique).toHaveBeenLastCalledWith({ where: { id: 8 } });
  });

  test('update passes data through and maps result with kind', async () => {
    prisma.lightingType.update.mockResolvedValue({
      id: 3,
      key: 'dir',
      label: 'Directional',
    } as any);

    const result = await service.update('LIGHTING', 3, { label: 'Directional' });

    expect(prisma.lightingType.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { label: 'Directional' },
    });
    expect(result).toEqual({
      id: 3,
      key: 'dir',
      label: 'Directional',
      kind: 'LIGHTING',
    });
  });

  test('create and update surface unique constraint violations as friendly errors', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError('unique', {
      clientVersion: 'test',
      code: 'P2002',
    } as any);

    prisma.splitType.create.mockRejectedValueOnce(uniqueError as never);
    await expect(service.create('SPLIT', { key: 'dup', label: 'Dup' })).rejects.toThrow(
      'Key already exists',
    );

    prisma.splitType.update.mockRejectedValueOnce(uniqueError as never);
    await expect(service.update('SPLIT', 1, { label: 'Dup' })).rejects.toThrow(
      'Key already exists',
    );
  });

  test('setActive updates the active flag and maps response', async () => {
    prisma.sourceType.update.mockResolvedValue({
      id: 9,
      active: false,
    } as any);

    const result = await service.setActive('SOURCE', 9, false);

    expect(prisma.sourceType.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { active: false },
    });
    expect(result).toEqual({ id: 9, active: false, kind: 'SOURCE' });
  });

  test('delete removes the taxonomy row and returns true', async () => {
    prisma.sourceType.delete.mockResolvedValue({} as any);

    await expect(service.delete('SOURCE', 5)).resolves.toBe(true);
    expect(prisma.sourceType.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  test('reorder updates display order within a transaction and returns latest list', async () => {
    (prisma.splitType.update as jest.Mock).mockImplementation(({ where, data }: any) =>
      Promise.resolve({ id: where.id, displayOrder: data.displayOrder }),
    );
    const listSpy = jest
      .spyOn(service, 'list')
      .mockResolvedValue([{ id: 1, displayOrder: 2, kind: 'SPLIT' } as any]);
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(async (operations: any[]) => {
      await Promise.all(operations);
      return [];
    });

    const items = [
      { id: 1, displayOrder: 2 },
      { id: 2, displayOrder: 3 },
    ];

    const result = await service.reorder('SPLIT', items);

    expect(prisma.$transaction).toHaveBeenCalled();
    const updates = prisma.$transaction.mock.calls[0][0];
    expect(updates).toHaveLength(2);
    expect(prisma.splitType.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { displayOrder: 2 },
    });
    expect(prisma.splitType.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { displayOrder: 3 },
    });
    expect(result).toEqual([{ id: 1, displayOrder: 2, kind: 'SPLIT' }]);
    expect(listSpy).toHaveBeenCalledWith('SPLIT', undefined);
  });
});
