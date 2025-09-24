+53 - 0;

import { AppRole, GymRole } from '../../../src/modules/auth/auth.types';
import { userIsTrustedForGym } from '../../../src/modules/gym/permission-helpers';

describe('userIsTrustedForGym', () => {
  const createClient = (returnValue: any) => ({
    user: {
      findUnique: jest.fn().mockResolvedValue(returnValue),
    },
  });

  it('returns false when user is not found', async () => {
    const client = createClient(null);

    await expect(userIsTrustedForGym(1, 2, client as any)).resolves.toBe(false);
    expect(client.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: {
        appRole: true,
        gymManagementRoles: { where: { gymId: 2 }, select: { role: true } },
      },
    });
  });

  it('grants access when user has an app-wide admin role', async () => {
    const client = createClient({
      appRole: AppRole.ADMIN,
      gymManagementRoles: [],
    });

    await expect(userIsTrustedForGym(5, 9, client as any)).resolves.toBe(true);
  });

  it('grants access when user manages the specified gym', async () => {
    const client = createClient({
      appRole: undefined,
      gymManagementRoles: [{ role: GymRole.GYM_ADMIN }, { role: GymRole.GYM_MODERATOR }],
    });

    await expect(userIsTrustedForGym(3, 4, client as any)).resolves.toBe(true);
  });

  it('denies access when user lacks privileged roles', async () => {
    const client = createClient({
      appRole: undefined,
      gymManagementRoles: [],
    });

    await expect(userIsTrustedForGym(7, 8, client as any)).resolves.toBe(false);
  });
});
