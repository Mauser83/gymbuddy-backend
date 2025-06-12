import { PermissionService } from '../../../src/modules/core/permission.service';
import { PermissionType } from '../../../src/modules/auth/auth.types';
import { PrismaClient, AppRole, UserRole, GymRole } from '../../../src/generated/prisma';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('PermissionService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: PermissionService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new PermissionService(prisma);
  });

  describe('basic verifiers', () => {
    test('verifyAppRoles', () => {
      const result = service.verifyAppRoles([AppRole.ADMIN], [AppRole.ADMIN]);
      expect(result).toBe(true);
    });

    test('verifyUserRoles', () => {
      const result = service.verifyUserRoles([UserRole.USER], [UserRole.USER]);
      expect(result).toBe(true);
    });

    test('verifyGymRoles', () => {
      const roles = new Map<number, GymRole[]>();
      roles.set(1, [GymRole.GYM_ADMIN]);
      expect(service.verifyGymRoles(roles, 1, [GymRole.GYM_ADMIN])).toBe(true);
    });

    test('verifyOwnership', () => {
      expect(service.verifyOwnership(1, 1)).toBe(true);
      expect(service.verifyOwnership(1, 2)).toBe(false);
    });

    test('verifyPremiumAccess', () => {
      expect(service.verifyPremiumAccess([UserRole.USER], true)).toBe(true);
      expect(service.verifyPremiumAccess([UserRole.PREMIUM_USER], false)).toBe(true);
      expect(service.verifyPremiumAccess([UserRole.USER], false)).toBe(false);
    });
  });

  describe('checkPermission', () => {
    const baseRoles = {
      appRoles: [AppRole.ADMIN],
      userRoles: [UserRole.USER],
      gymRoles: new Map<number, GymRole[]>(),
    };

    test('OWNERSHIP', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.OWNERSHIP,
        userId: 1,
        userRoles: baseRoles,
        resource: { ownerId: 1 },
      });
      expect(result).toBe(true);
    });

    test('APP_SCOPE', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.APP_SCOPE,
        userId: 1,
        userRoles: baseRoles,
        requiredRoles: { appRoles: [AppRole.ADMIN] },
      });
      expect(result).toBe(true);
    });

    test('GYM_SCOPE', () => {
      const gymRoles = new Map<number, GymRole[]>();
      gymRoles.set(2, [GymRole.GYM_ADMIN]);
      const result = service.checkPermission({
        permissionType: PermissionType.GYM_SCOPE,
        userId: 1,
        userRoles: { ...baseRoles, gymRoles },
        resource: { gymId: 2 },
        requiredRoles: { gymRoles: [GymRole.GYM_ADMIN] },
      });
      expect(result).toBe(true);
    });

    test('PREMIUM_FEATURE', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.PREMIUM_FEATURE,
        userId: 1,
        userRoles: baseRoles,
        isPremiumActive: true,
      });
      expect(result).toBe(true);
    });
  });
});
