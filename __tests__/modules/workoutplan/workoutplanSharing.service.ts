import { SharingService } from '../../../src/modules/workoutplan/workoutplanSharing.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../../src/lib/prisma';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { PermissionType } from '../../../src/modules/auth/auth.types';

describe('SharingService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let permission: { getUserRoles: jest.Mock; checkPermission: jest.Mock };
  let service: SharingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permission = { getUserRoles: jest.fn(), checkPermission: jest.fn() } as any;
    service = new SharingService(prisma, permission as any);
  });

  test('shareWorkoutPlan verifies permission and updates', async () => {
    jest.spyOn(service, 'verifySharingPermission').mockResolvedValue(true);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    const res = await service.shareWorkoutPlan(1, 2, 3, 'VIEW');
    expect(service.verifySharingPermission).toHaveBeenCalledWith(1, 2);
    expect(prisma.workoutPlan.update).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('verifySharingPermission delegates to PermissionService', async () => {
    permission.getUserRoles.mockResolvedValue({} as any);
    permission.checkPermission.mockReturnValue(true);
    const result = await service.verifySharingPermission(1, 2);
    expect(permission.checkPermission).toHaveBeenCalledWith({
      permissionType: PermissionType.OWNERSHIP,
      userId: 1,
      userRoles: {},
      resource: { ownerId: 2 },
    });
    expect(result).toBe(true);
  });

  test('canAccessWorkoutPlan checks owner and shared list', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({ userId: 1, sharedWith: [{ id: 2 }] } as any);
    const result = await service.canAccessWorkoutPlan(2, 1);
    expect(result).toBe(true);
  });

  test('shareWorkoutProgram verifies permission and updates', async () => {
    jest.spyOn(service, 'verifyProgramSharingPermission').mockResolvedValue(true);
    prisma.workoutProgram.update.mockResolvedValue({ id: 1 } as any);
    await service.shareWorkoutProgram(1, 2, 3, 'VIEW');
    expect(service.verifyProgramSharingPermission).toHaveBeenCalledWith(1, 2);
    expect(prisma.workoutProgram.update).toHaveBeenCalled();
  });
});
