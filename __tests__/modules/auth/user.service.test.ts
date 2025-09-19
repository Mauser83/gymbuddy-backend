import { UserService } from '../../../src/modules/auth/user.service';

const prisma = {
  user: {
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};
const permissionService = {
  getUserRoles: jest.fn(),
  verifyAppRoles: jest.fn(),
};
const auditService = {
  logDataUpdate: jest.fn(),
  logDataDeletion: jest.fn(),
};

describe('UserService', () => {
  let service: UserService;
  beforeEach(() => {
    service = new UserService(prisma as any, permissionService as any, auditService as any);
    jest.clearAllMocks();
  });

  test('getUsers returns all for admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.user.findMany.mockResolvedValue([{ id: 1 }]);
    const result = await service.getUsers(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {},
      select: { id: true, email: true, createdAt: true },
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  test('getUsers returns self for non admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    prisma.user.findMany.mockResolvedValue([{ id: 1 }]);
    const result = await service.getUsers(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, email: true, createdAt: true },
    });
    expect(result).toEqual([{ id: 1 }]);
  });

  test('updateUser throws when insufficient permissions', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.updateUser(1, 2, {})).rejects.toThrow('Insufficient permissions');
  });

  test('updateUser allows self', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    prisma.user.update.mockResolvedValue({ id: 1 });
    const result = await service.updateUser(1, 1, { email: 'a' });
    expect(result).toEqual({ id: 1 });
    expect(auditService.logDataUpdate).toHaveBeenCalled();
  });

  test('deleteUser only admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.deleteUser(1, 2)).rejects.toThrow('Only admins can delete users');
  });

  test('deleteUser as admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.user.update.mockResolvedValue({ id: 2 });
    const result = await service.deleteUser(1, 2);
    expect(result).toEqual({ id: 2 });
    expect(auditService.logDataDeletion).toHaveBeenCalled();
  });
});
