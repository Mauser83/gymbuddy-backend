import { PrismaClient } from '../../lib/prisma';
import { PermissionService } from '../core/permission.service';
import { AuditService } from '../core/audit.service';

export class UserService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;
  private auditService: AuditService;

  constructor(
    prisma: PrismaClient,
    permissionService: PermissionService,
    auditService: AuditService
  ) {
    this.prisma = prisma;
    this.permissionService = permissionService;
    this.auditService = auditService;
  }

  async getUsers(requesterId: string) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const canViewAll = this.permissionService.verifyAppRoles(
      userRoles.appRoles,
      ['ADMIN', 'MODERATOR']
    );

    return this.prisma.user.findMany({
      where: canViewAll ? {} : { id: Number(requesterId) },
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });
  }

  async updateUser(requesterId: string, userId: string, data: any) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const isAdmin = this.permissionService.verifyAppRoles(
      userRoles.appRoles, 
      ['ADMIN']
    );
    const isSelf = requesterId === userId;

    if (!isAdmin && requesterId !== userId) {
      throw new Error('Insufficient permissions');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: Number(userId) },
      data,
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    await this.auditService.logDataUpdate({
      userId: Number(requesterId),
      entity: 'User',
      entityId: updatedUser.id,
      changes: data
    });

    return updatedUser;
  }

  async deleteUser(requesterId: string, userId: string) {
    const userRoles = await this.permissionService.getUserRoles(requesterId);
    const isAdmin = this.permissionService.verifyAppRoles(
      userRoles.appRoles,
      ['ADMIN']
    );

    if (!isAdmin) {
      throw new Error('Only admins can delete users');
    }

    const result = await this.prisma.user.update({
      where: { id: Number(userId) },
      data: { deletedAt: new Date() }
    });

    await this.auditService.logDataDeletion({
      userId: Number(requesterId),
      entity: 'User',
      entityId: result.id
    });

    return result;
  }
}