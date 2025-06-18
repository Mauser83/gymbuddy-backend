import { PrismaClient, AppRole, GymRole, UserRole } from "../../lib/prisma";
import { PermissionType } from "../auth/auth.types";

interface UserRoles {
  appRoles: AppRole[];
  userRoles: UserRole[];
  gymRoles: Map<number, GymRole[]>;
}

export class PermissionService {
  private prisma: PrismaClient;
  private prismaInstanceId: string; // Add this field

  constructor(prisma: PrismaClient, prismaInstanceId?: string) {
    this.prisma = prisma;
    this.prismaInstanceId = prismaInstanceId || "default";
  }

  async getUserRoles(userId: number): Promise<UserRoles> {

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { gymManagementRoles: true },
    });

    const users = await this.prisma.user.findMany();

    if (!user) {
      throw new Error("User not found");
    }

    const gymRoles = new Map<number, GymRole[]>();
    user.gymManagementRoles.forEach((role) => {
      const roles = gymRoles.get(role.gymId) || [];
      roles.push(role.role);
      gymRoles.set(role.gymId, roles);
    });

    return {
      appRoles: user.appRole ? [user.appRole] : [],
      userRoles: [user.userRole],
      gymRoles,
    };
  }

  /**
   * Verify if user has required application roles
   * @param userRoles User's roles to check against
   * @param requiredRoles Required roles (OR condition)
   */
  verifyAppRoles(userRoles: AppRole[], requiredRoles: AppRole[]): boolean {
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  /**
   * Verify if user has required user roles
   * @param userRoles User's roles to check against
   * @param requiredRoles Required roles (OR condition)
   */
  verifyUserRoles(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  /**
   * Verify if user has required gym roles for a specific gym
   * @param userGymRoles User's gym roles (map of gymId to roles)
   * @param gymId Target gym ID
   * @param requiredRoles Required roles (OR condition)
   */
  verifyGymRoles(
    userGymRoles: Map<number, GymRole[]>,
    gymId: number,
    requiredRoles: GymRole[]
  ): boolean {
    const roles = userGymRoles.get(gymId) || [];
    return requiredRoles.some((role) => roles.includes(role));
  }

  /**
   * Verify ownership of a resource
   * @param ownerId Resource owner's ID
   * @param userId Current user's ID
   */
  verifyOwnership(ownerId: number, userId: number): boolean {
    return ownerId === userId;
  }

  /**
   * Verify premium feature access
   * @param userRoles User's roles
   * @param isPremiumActive Whether user's premium subscription is active
   */
  verifyPremiumAccess(
    userRoles: UserRole[],
    isPremiumActive: boolean
  ): boolean {
    return isPremiumActive || userRoles.includes(UserRole.PREMIUM_USER);
  }

  /**
   * Comprehensive permission check
   * @param options Permission check options
   */
  checkPermission(options: {
    permissionType: PermissionType;
    userId: number;
    userRoles: {
      appRoles: AppRole[];
      userRoles: UserRole[];
      gymRoles: Map<number, GymRole[]>;
    };
    resource?: {
      ownerId?: number;
      gymId?: number;
    };
    isPremiumActive?: boolean;
    requiredRoles?: {
      appRoles?: AppRole[];
      userRoles?: UserRole[];
      gymRoles?: GymRole[];
    };
  }): boolean {
    switch (options.permissionType) {
      case PermissionType.OWNERSHIP:
        if (!options.resource?.ownerId) return false;
        return this.verifyOwnership(options.resource.ownerId, options.userId);

      case PermissionType.GYM_SCOPE:
        if (!options.resource?.gymId || !options.requiredRoles?.gymRoles)
          return false;
        return this.verifyGymRoles(
          options.userRoles.gymRoles,
          options.resource.gymId,
          options.requiredRoles.gymRoles
        );

      case PermissionType.APP_SCOPE:
        if (!options.requiredRoles?.appRoles) return false;
        return this.verifyAppRoles(
          options.userRoles.appRoles,
          options.requiredRoles.appRoles
        );

      case PermissionType.PREMIUM_FEATURE:
        if (options.isPremiumActive === undefined) return false;
        return this.verifyPremiumAccess(
          options.userRoles.userRoles,
          options.isPremiumActive
        );

      default:
        return false;
    }
  }
}
