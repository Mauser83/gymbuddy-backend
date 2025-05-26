import { PrismaClient } from '../../lib/prisma';
import { PermissionService } from '../core/permission.service';
import { PermissionType } from '../auth/auth.types';
import type { User } from '../../lib/prisma';

export class SharingService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  async shareWorkoutPlan(ownerId: number, workoutPlanId: number, userId: number, accessLevel: 'VIEW' | 'EDIT') {
    // Verify owner has permission to share
    const canShare = await this.verifySharingPermission(ownerId, workoutPlanId);
    if (!canShare) {
      throw new Error('Insufficient permissions to share this workout');
    }

    return this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: {
        sharedWith: {
          connect: { id: userId }
        }
      }
    });
  }

  async verifySharingPermission(userId: number, resourceId: number): Promise<boolean> {
    const userRoles = await this.permissionService.getUserRoles(userId);
    return this.permissionService.checkPermission({
      permissionType: PermissionType.OWNERSHIP,
      userId,
      userRoles,
      resource: { ownerId: resourceId }
    });
  }

  async canAccessWorkoutPlan(userId: number, workoutPlanId: number): Promise<boolean> {
    const workoutPlan = await this.prisma.workoutPlan.findUnique({
      where: { id: workoutPlanId },
      include: { sharedWith: true }
    });

    if (!workoutPlan) return false;

    // Check ownership
    if (workoutPlan.userId === userId) return true;

    // Check sharing
    return workoutPlan.sharedWith.some((user: User) => user.id === userId);
  }

  async shareWorkoutProgram(ownerId: number, programId: number, userId: number, accessLevel: 'VIEW' | 'EDIT') {
  const canShare = await this.verifyProgramSharingPermission(ownerId, programId);
  if (!canShare) {
    throw new Error('Insufficient permissions to share this program');
  }

  return this.prisma.workoutProgram.update({
    where: { id: programId },
    data: {
      sharedWith: {
        connect: { id: userId }
      }
    }
  });
}

async verifyProgramSharingPermission(userId: number, programId: number): Promise<boolean> {
  const program = await this.prisma.workoutProgram.findUnique({
    where: { id: programId }
  });

  if (!program) return false;

  const userRoles = await this.permissionService.getUserRoles(userId);

  return this.permissionService.checkPermission({
    permissionType: PermissionType.OWNERSHIP,
    userId,
    userRoles,
    resource: { ownerId: program.userId }
  });
}

async canAccessWorkoutProgram(userId: number, programId: number): Promise<boolean> {
  const program = await this.prisma.workoutProgram.findUnique({
    where: { id: programId },
    include: { sharedWith: true }
  });

  if (!program) return false;

  return program.userId === userId || program.sharedWith.some((user: User) => user.id === userId);
}
}