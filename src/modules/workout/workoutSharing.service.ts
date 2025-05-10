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

  async shareWorkout(ownerId: string, workoutId: string, userId: string, accessLevel: 'VIEW' | 'EDIT') {
    // Verify owner has permission to share
    const canShare = await this.verifySharingPermission(ownerId, workoutId);
    if (!canShare) {
      throw new Error('Insufficient permissions to share this workout');
    }

    return this.prisma.workoutPlan.update({
      where: { id: Number(workoutId) },
      data: {
        sharedWith: {
          connect: { id: Number(userId) }
        }
      }
    });
  }

  async verifySharingPermission(userId: string, resourceId: string): Promise<boolean> {
    const userRoles = await this.permissionService.getUserRoles(userId);
    return this.permissionService.checkPermission({
      permissionType: PermissionType.OWNERSHIP,
      userId,
      userRoles,
      resource: { ownerId: resourceId }
    });
  }

  async canAccessWorkout(userId: string, workoutId: string): Promise<boolean> {
    const workout = await this.prisma.workoutPlan.findUnique({
      where: { id: Number(workoutId) },
      include: { sharedWith: true }
    });

    if (!workout) return false;

    // Check ownership
    if (workout.userId === Number(userId)) return true;

    // Check sharing
    return workout.sharedWith.some((user: User) => user.id === Number(userId));
  }
}