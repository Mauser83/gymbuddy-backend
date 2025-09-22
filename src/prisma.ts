import { PrismaClient } from './generated/prisma';
import type { Prisma as PrismaNamespace } from './generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from './generated/prisma';
export type JsonObject = PrismaNamespace.JsonObject;
