import { PrismaClient } from '../../lib/prisma';
import { AuditService } from '../core/audit.service';
import { PermissionService } from '../core/permission.service';

export class UserService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;
  private auditService: AuditService;

  constructor(
    prisma: PrismaClient,
    permissionService: PermissionService,
    auditService: AuditService,
  ) {
    this.prisma = prisma;
    this.permissionService = permissionService;
    this.auditService = auditService;
  }

  async getUsers(requesterId: number) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const canViewAll = this.permissionService.verifyAppRoles(userRoles.appRoles, [
      'ADMIN',
      'MODERATOR',
    ]);

    return this.prisma.user.findMany({
      where: canViewAll ? {} : { id: requesterId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async updateUser(requesterId: number, userId: number, data: any) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, ['ADMIN']);

    if (!isAdmin && requesterId !== userId) {
      throw new Error('Insufficient permissions');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    await this.auditService.logDataUpdate({
      userId: requesterId,
      entity: 'User',
      entityId: updatedUser.id,
      changes: data,
    });

    return updatedUser;
  }

  async deleteUser(requesterId: number, userId: number) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, ['ADMIN']);

    if (!isAdmin) {
      throw new Error('Only admins can delete users');
    }

    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.logDataDeletion({
      userId: requesterId,
      entity: 'User',
      entityId: result.id,
    });

    return result;
  }
}
