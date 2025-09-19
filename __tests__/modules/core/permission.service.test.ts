import { PermissionService } from '../../../src/modules/core/permission.service';
import { PrismaClient, AppRole, UserRole, GymRole } from '../../../src/lib/prisma';
import { PermissionType } from '../../../src/modules/auth/auth.types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('PermissionService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: PermissionService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new PermissionService(prisma);
  });

  describe('getUserRoles', () => {
    test('returns mapped roles for user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        appRole: AppRole.ADMIN,
        userRole: UserRole.USER,
        gymManagementRoles: [
          { gymId: 1, role: GymRole.GYM_ADMIN },
          { gymId: 1, role: GymRole.GYM_MODERATOR },
          { gymId: 2, role: GymRole.GYM_ADMIN },
        ],
      } as any);
      prisma.user.findMany.mockResolvedValue([] as any);

      const roles = await service.getUserRoles(1);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { gymManagementRoles: true },
      });
      expect(roles.appRoles).toEqual([AppRole.ADMIN]);
      expect(roles.userRoles).toEqual([UserRole.USER]);
      expect(Array.from(roles.gymRoles.entries())).toEqual([
        [1, [GymRole.GYM_ADMIN, GymRole.GYM_MODERATOR]],
        [2, [GymRole.GYM_ADMIN]],
      ]);
    });

    test('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([] as any);
      await expect(service.getUserRoles(1)).rejects.toThrow('User not found');
    });
  });

  describe('verify methods', () => {
    test('verifyAppRoles checks membership', () => {
      expect(service.verifyAppRoles([AppRole.ADMIN], [AppRole.ADMIN])).toBe(true);
      expect(service.verifyAppRoles([], [AppRole.ADMIN])).toBe(false);
    });

    test('verifyUserRoles checks membership', () => {
      expect(service.verifyUserRoles([UserRole.USER], [UserRole.USER])).toBe(true);
      expect(service.verifyUserRoles([], [UserRole.USER])).toBe(false);
    });

    test('verifyGymRoles checks roles per gym', () => {
      const map = new Map<number, GymRole[]>([[1, [GymRole.GYM_ADMIN]]]);
      expect(service.verifyGymRoles(map, 1, [GymRole.GYM_ADMIN])).toBe(true);
      expect(service.verifyGymRoles(map, 2, [GymRole.GYM_ADMIN])).toBe(false);
    });

    test('verifyOwnership compares ids', () => {
      expect(service.verifyOwnership(1, 1)).toBe(true);
      expect(service.verifyOwnership(1, 2)).toBe(false);
    });

    test('verifyPremiumAccess checks premium or role', () => {
      expect(service.verifyPremiumAccess([UserRole.USER], true)).toBe(true);
      expect(service.verifyPremiumAccess([UserRole.PREMIUM_USER], false)).toBe(true);
      expect(service.verifyPremiumAccess([UserRole.USER], false)).toBe(false);
    });
  });

  describe('checkPermission', () => {
    test('ownership', () => {
      const spy = jest.spyOn(service, 'verifyOwnership');
      service.checkPermission({
        permissionType: PermissionType.OWNERSHIP,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
        resource: { ownerId: 1 },
      });
      expect(spy).toHaveBeenCalledWith(1, 1);
    });

    test('ownership missing data returns false', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.OWNERSHIP,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
      } as any);
      expect(result).toBe(false);
    });

    test('gym scope', () => {
      const spy = jest.spyOn(service, 'verifyGymRoles').mockReturnValue(true);
      const map = new Map<number, GymRole[]>();
      map.set(1, [GymRole.GYM_ADMIN]);
      const result = service.checkPermission({
        permissionType: PermissionType.GYM_SCOPE,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: map },
        resource: { gymId: 1 },
        requiredRoles: { gymRoles: [GymRole.GYM_ADMIN] },
      });
      expect(spy).toHaveBeenCalledWith(map, 1, [GymRole.GYM_ADMIN]);
      expect(result).toBe(true);
    });

    test('gym scope missing info returns false', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.GYM_SCOPE,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
      } as any);
      expect(result).toBe(false);
    });

    test('app scope', () => {
      const spy = jest.spyOn(service, 'verifyAppRoles').mockReturnValue(true);
      const result = service.checkPermission({
        permissionType: PermissionType.APP_SCOPE,
        userId: 1,
        userRoles: { appRoles: [AppRole.ADMIN], userRoles: [], gymRoles: new Map() },
        requiredRoles: { appRoles: [AppRole.ADMIN] },
      });
      expect(spy).toHaveBeenCalledWith([AppRole.ADMIN], [AppRole.ADMIN]);
      expect(result).toBe(true);
    });

    test('app scope missing roles returns false', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.APP_SCOPE,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
      } as any);
      expect(result).toBe(false);
    });

    test('premium feature', () => {
      const spy = jest.spyOn(service, 'verifyPremiumAccess').mockReturnValue(true);
      const result = service.checkPermission({
        permissionType: PermissionType.PREMIUM_FEATURE,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [UserRole.USER], gymRoles: new Map() },
        isPremiumActive: true,
      });
      expect(spy).toHaveBeenCalledWith([UserRole.USER], true);
      expect(result).toBe(true);
    });

    test('premium feature missing flag returns false', () => {
      const result = service.checkPermission({
        permissionType: PermissionType.PREMIUM_FEATURE,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
      } as any);
      expect(result).toBe(false);
    });

    test('unknown permission type returns false', () => {
      const result = service.checkPermission({
        permissionType: 'OTHER' as any,
        userId: 1,
        userRoles: { appRoles: [], userRoles: [], gymRoles: new Map() },
      });
      expect(result).toBe(false);
    });
  });
});
