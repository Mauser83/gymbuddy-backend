import type { PrismaClient } from '../src/generated/prisma';

jest.mock('../src/generated/prisma', () => {
  const PrismaClientMock = jest.fn(() => ({
    $connect: jest.fn(),
  }));

  return {
    PrismaClient: PrismaClientMock,
    Prisma: { JsonObject: {} },
  };
});

const getPrismaClientMock = () =>
  (jest.requireMock('../src/generated/prisma') as { PrismaClient: jest.Mock }).PrismaClient;

const loadPrismaModule = () => require('../src/prisma') as typeof import('../src/prisma');

describe('prisma singleton export', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (globalThis as { prisma?: PrismaClient }).prisma;
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();
  });

  test('reuses existing global prisma instance when present', async () => {
    const existing = { already: true } as unknown as PrismaClient;
    (globalThis as { prisma?: PrismaClient }).prisma = existing;

    const { prisma } = loadPrismaModule();

    expect(prisma).toBe(existing);
    expect(getPrismaClientMock()).not.toHaveBeenCalled();
  });

  test('creates a new prisma instance and caches it outside production', async () => {
    process.env.NODE_ENV = 'development';

    const { prisma } = loadPrismaModule();

    const prismaClientMock = getPrismaClientMock();
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
    expect((globalThis as { prisma?: PrismaClient }).prisma).toBe(prisma);
  });

  test('does not cache prisma globally in production', async () => {
    process.env.NODE_ENV = 'production';

    const { prisma } = loadPrismaModule();

    const prismaClientMock = getPrismaClientMock();
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
    expect((globalThis as { prisma?: PrismaClient }).prisma).toBeUndefined();
    expect(prisma).toBeDefined();
  });
});
