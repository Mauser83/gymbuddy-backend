import {
  PrismaClient as ProdPrismaClient,
  User as ProdUser,
  Gym as ProdGym,
  UserRole as ProdUserRole,
  AppRole as ProdAppRole,
  GymRole as ProdGymRole,
  AuditLog as ProdAuditLog,
  Prisma as ProdPrisma,
} from '../generated/prisma';

const isTest = process.env.NODE_ENV === 'test';

// Dynamically load the test Prisma client when running tests
let testPrisma: any | undefined;
if (isTest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    testPrisma = require('../generated/test-prisma');
  } catch {
    testPrisma = undefined;
  }
}

const prisma: ProdPrismaClient =
  isTest && testPrisma
    ? (new testPrisma.PrismaClient() as unknown as ProdPrismaClient)
    : new ProdPrismaClient();

// Static types — always from production
export type PrismaClient = ProdPrismaClient;
export type User = ProdUser;
export type Gym = ProdGym;
export type UserRole = ProdUserRole;
export type AppRole = ProdAppRole;
export type GymRole = ProdGymRole;
export type AuditLog = ProdAuditLog;
export type JsonObject = ProdPrisma.JsonObject;

// Runtime values — dynamic (test vs prod)
const UserRoleEnum = isTest && testPrisma ? testPrisma.UserRole : ProdUserRole;
const AppRoleEnum = isTest && testPrisma ? testPrisma.AppRole : ProdAppRole;
const GymRoleEnum = isTest && testPrisma ? testPrisma.GymRole : ProdGymRole;
const PrismaNamespace = isTest && testPrisma ? testPrisma.Prisma : ProdPrisma;

export {
  prisma,
  UserRoleEnum as UserRole,
  AppRoleEnum as AppRole,
  GymRoleEnum as GymRole,
  PrismaNamespace as Prisma,
};
