import { GraphQLError } from 'graphql';

import { AuthContext, GymRole, PermissionType } from './auth.types';
import { PermissionService } from '../core/permission.service';

export function verifyRoles(
  context: AuthContext,
  options:
    | {
        requireAppRole?: 'ADMIN' | 'MODERATOR';
        requireUserRole?: 'USER' | 'PREMIUM_USER' | 'PERSONAL_TRAINER';
        requireGymRole?: { gymId: number; role: GymRole };
      }
    | { or: any[] },
) {
  const check = (opts: any) => {
    if (opts.requireAppRole && context.appRole !== opts.requireAppRole) return false;
    if (opts.requireUserRole && context.userRole !== opts.requireUserRole) return false;
    if (
      opts.requireGymRole &&
      !context.gymRoles.some(
        (r) => r.gymId === opts.requireGymRole.gymId && r.role === opts.requireGymRole.role,
      )
    )
      return false;
    return true;
  };

  const allowed = 'or' in options ? options.or.some((cond) => check(cond)) : check(options);

  if (!allowed) {
    throw new GraphQLError('Insufficient permissions', { extensions: { code: 'FORBIDDEN' } });
  }
}

export function verifyGymScope(
  context: AuthContext,
  permissionService: PermissionService,
  gymId: number,
  requiredRoles: GymRole[] = [GymRole.GYM_ADMIN, GymRole.GYM_MODERATOR],
) {
  if (context.appRole === 'ADMIN') return;

  const gymRoles = new Map<number, GymRole[]>();
  for (const role of context.gymRoles) {
    const current = gymRoles.get(role.gymId) || [];
    current.push(role.role);
    gymRoles.set(role.gymId, current);
  }

  const hasAccess = permissionService.checkPermission({
    permissionType: 'GYM_SCOPE' as PermissionType,
    userId: context.userId!,
    userRoles: {
      appRoles: context.appRole ? [context.appRole] : [],
      userRoles: [context.userRole],
      gymRoles,
    },
    resource: { gymId },
    requiredRoles: { gymRoles: requiredRoles },
  });

  if (!hasAccess) {
    throw new GraphQLError('Insufficient gym permissions');
  }
}

export function verifyPremiumAccess(context: AuthContext, requiredTier: 'BASIC' | 'PRO' = 'BASIC') {
  if (context.appRole === 'ADMIN') return;
  const isPremium = context.userRole === 'PREMIUM_USER' || context.userRole === 'PERSONAL_TRAINER';
  if (!isPremium) {
    throw new GraphQLError('Premium subscription required', {
      extensions: { code: 'PAYMENT_REQUIRED', requiredTier },
    });
  }
}
