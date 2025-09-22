import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { TaxonomyService } from '../../../src/modules/cv/taxonomy.service';
import { PrismaClient } from '../../../src/prisma';

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
});
