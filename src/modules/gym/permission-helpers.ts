import { AppRole, GymRole, prisma, PrismaClient } from '../../prisma';

/**
 * Determine if a user is trusted for a given gym.
 * Trusted users include app ADMIN/MODERATOR or gym GYM_ADMIN/GYM_MODERATOR.
 */
export async function userIsTrustedForGym(
  userId: number,
  gymId: number,
  client: PrismaClient = prisma,
): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      appRole: true,
      gymManagementRoles: { where: { gymId }, select: { role: true } },
    },
  });
  if (!user) return false;
  if (user.appRole && [AppRole.ADMIN, AppRole.MODERATOR].includes(user.appRole)) {
    return true;
  }
  return user.gymManagementRoles.some((r) =>
    [GymRole.GYM_ADMIN, GymRole.GYM_MODERATOR].includes(r.role),
  );
}
