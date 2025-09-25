import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PermissionType } from '../../../src/modules/auth/auth.types';
import { SharingService } from '../../../src/modules/workoutplan/workoutplanSharing.service';
import { PrismaClient } from '../../../src/prisma';

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

  test('shareWorkoutPlan throws when permission denied', async () => {
    jest.spyOn(service, 'verifySharingPermission').mockResolvedValue(false);

    await expect(service.shareWorkoutPlan(1, 2, 3, 'EDIT')).rejects.toThrow(
      'Insufficient permissions to share this workout',
    );
    expect(prisma.workoutPlan.update).not.toHaveBeenCalled();
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

  test('canAccessWorkoutPlan returns true for owner and false when missing', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValueOnce({
      userId: 9,
      sharedWith: [],
    } as any);
    await expect(service.canAccessWorkoutPlan(9, 42)).resolves.toBe(true);

    prisma.workoutPlan.findUnique.mockResolvedValueOnce(null as any);
    await expect(service.canAccessWorkoutPlan(9, 42)).resolves.toBe(false);
  });

  test('shareWorkoutProgram verifies permission and updates', async () => {
    jest.spyOn(service, 'verifyProgramSharingPermission').mockResolvedValue(true);
    prisma.workoutProgram.update.mockResolvedValue({ id: 1 } as any);
    await service.shareWorkoutProgram(1, 2, 3, 'VIEW');
    expect(service.verifyProgramSharingPermission).toHaveBeenCalledWith(1, 2);
    expect(prisma.workoutProgram.update).toHaveBeenCalled();
  });

  test('shareWorkoutProgram throws when permission denied', async () => {
    jest.spyOn(service, 'verifyProgramSharingPermission').mockResolvedValue(false);

    await expect(service.shareWorkoutProgram(1, 2, 3, 'EDIT')).rejects.toThrow(
      'Insufficient permissions to share this program',
    );
    expect(prisma.workoutProgram.update).not.toHaveBeenCalled();
  });

  test('verifyProgramSharingPermission handles missing program', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValueOnce(null as any);
    const result = await service.verifyProgramSharingPermission(1, 55);
    expect(result).toBe(false);
    expect(permission.getUserRoles).not.toHaveBeenCalled();
  });

  test('verifyProgramSharingPermission checks ownership via PermissionService', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValueOnce({ userId: 3 } as any);
    permission.getUserRoles.mockResolvedValueOnce({ roles: ['USER'] } as any);
    permission.checkPermission.mockReturnValueOnce(false);

    const denied = await service.verifyProgramSharingPermission(2, 10);
    expect(permission.checkPermission).toHaveBeenCalledWith({
      permissionType: PermissionType.OWNERSHIP,
      userId: 2,
      userRoles: { roles: ['USER'] },
      resource: { ownerId: 3 },
    });
    expect(denied).toBe(false);
  });

  test('canAccessWorkoutProgram checks owner, shared users, and missing records', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValueOnce({
      userId: 7,
      sharedWith: [],
    } as any);
    await expect(service.canAccessWorkoutProgram(7, 1)).resolves.toBe(true);

    prisma.workoutProgram.findUnique.mockResolvedValueOnce({
      userId: 7,
      sharedWith: [{ id: 8 }],
    } as any);
    await expect(service.canAccessWorkoutProgram(8, 2)).resolves.toBe(true);

    prisma.workoutProgram.findUnique.mockResolvedValueOnce(null as any);
    await expect(service.canAccessWorkoutProgram(8, 3)).resolves.toBe(false);
  });
});
