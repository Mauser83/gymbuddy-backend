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

  async shareWorkout(ownerId: number, workoutId: number, userId: number, accessLevel: 'VIEW' | 'EDIT') {
    // Verify owner has permission to share
    const canShare = await this.verifySharingPermission(ownerId, workoutId);
    if (!canShare) {
      throw new Error('Insufficient permissions to share this workout');
    }

    return this.prisma.workoutPlan.update({
      where: { id: workoutId },
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

  async canAccessWorkout(userId: number, workoutId: number): Promise<boolean> {
    const workout = await this.prisma.workoutPlan.findUnique({
      where: { id: workoutId },
      include: { sharedWith: true }
    });

    if (!workout) return false;

    // Check ownership
    if (workout.userId === userId) return true;

    // Check sharing
    return workout.sharedWith.some((user: User) => user.id === userId);
  }
}