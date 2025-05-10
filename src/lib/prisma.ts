import {
  PrismaClient as TestPrismaClient,
  UserRole as TestUserRole,
  AppRole as TestAppRole,
  GymRole as TestGymRole,
  Prisma as TestPrisma,
} from '../generated/test-prisma';

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

const prisma = isTest
  ? (new TestPrismaClient() as unknown as ProdPrismaClient)
  : new ProdPrismaClient();

// Static types — always from production
export type PrismaClient = ProdPrismaClient;
export type User = ProdUser;
export type Gym = ProdGym;
export type UserRole = ProdUserRole;
export type AppRole = ProdAppRole;
export type GymRole = ProdGymRole;
export type AuditLog = ProdAuditLog;
export type JsonObject =  ProdPrisma.JsonObject;

// Runtime values — dynamic (test vs prod)
const UserRole = isTest ? TestUserRole : ProdUserRole;
const AppRole = isTest ? TestAppRole : ProdAppRole;
const GymRole = isTest ? TestGymRole : ProdGymRole;
const Prisma = isTest ? TestPrisma : ProdPrisma;

// ❗ Notice AuditLog is NOT exported as a runtime value (because it's a type only!)

export { prisma, UserRole, AppRole, GymRole, Prisma }; 
// ✅ correct: AuditLog is exported only as a TYPE, not as a value
