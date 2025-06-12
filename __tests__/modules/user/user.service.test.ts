import { UserService } from '../../../src/modules/user/user.service';
import { PrismaClient, AppRole, UserRole } from '../../../src/lib/prisma';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { validateInput } from '../../../src/middlewares/validation';
import { verifyRoles } from '../../../src/modules/auth/auth.roles';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles');

const mockedValidate = jest.mocked(validateInput as any);
const mockedVerify = jest.mocked(verifyRoles as any);

function createContext(appRole: string = 'ADMIN') {
  return { userId: 1, appRole } as any;
}

describe('UserService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: UserService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new UserService(prisma);
    mockedValidate.mockResolvedValue(undefined as any);
    mockedVerify.mockReturnValue();
  });

  afterEach(() => jest.clearAllMocks());

  test('searchUsers without search returns all users', async () => {
    prisma.user.findMany.mockResolvedValue([] as any);
    const ctx = createContext();
    await service.searchUsers(ctx);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalledWith();
  });

  test('searchUsers with search filters by email and username', async () => {
    prisma.user.findMany.mockResolvedValue([] as any);
    const ctx = createContext();
    await service.searchUsers(ctx, 'bob');
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { username: { contains: 'bob', mode: 'insensitive' } },
          { email: { contains: 'bob', mode: 'insensitive' } },
        ],
      },
    });
  });

  test('getUserById fetches user with roles', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1 } as any);
    const ctx = createContext();
    const res = await service.getUserById(ctx, 1);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { gymManagementRoles: { include: { gym: true } } },
    });
    expect(res).toEqual({ id: 1 });
  });

  test('deleteUser removes user', async () => {
    prisma.user.delete.mockResolvedValue({ id: 1 } as any);
    const ctx = createContext();
    await service.deleteUser(ctx, 1);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  test('updateUserRoles updates roles for admin', async () => {
    prisma.user.update.mockResolvedValue({ id: 1 } as any);
    const ctx = createContext('ADMIN');
    await service.updateUserRoles(ctx, { userId: 1, appRole: 'MODERATOR', userRole: 'PREMIUM_USER' });
    expect(mockedValidate).toHaveBeenCalled();
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        userRole: 'PREMIUM_USER' as UserRole,
        tokenVersion: { increment: 1 },
        appRole: 'MODERATOR' as AppRole,
      },
      select: { id: true, email: true, username: true, appRole: true, userRole: true },
    });
  });

  test('updateUserRoles strips appRole when not admin', async () => {
    prisma.user.update.mockResolvedValue({ id: 1 } as any);
    const ctx = createContext('MODERATOR');
    await service.updateUserRoles(ctx, { userId: 1, appRole: 'ADMIN', userRole: 'PREMIUM_USER' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        userRole: 'PREMIUM_USER' as UserRole,
        tokenVersion: { increment: 1 },
      },
      select: { id: true, email: true, username: true, appRole: true, userRole: true },
    });
  });

  test('updateUserRoles sets appRole null when NONE provided', async () => {
    prisma.user.update.mockResolvedValue({ id: 1 } as any);
    const ctx = createContext('ADMIN');
    await service.updateUserRoles(ctx, { userId: 2, appRole: 'NONE', userRole: 'USER' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        userRole: 'USER' as UserRole,
        tokenVersion: { increment: 1 },
        appRole: null,
      },
      select: { id: true, email: true, username: true, appRole: true, userRole: true },
    });
  });

  test('updateTrainingPreferences updates provided fields', async () => {
    prisma.user.update.mockResolvedValue({ id: 1 } as any);
    await service.updateTrainingPreferences(1, { trainingGoalId: 3, experienceLevel: 'BEGINNER' as any });
    expect(mockedValidate).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { trainingGoalId: 3, experienceLevel: 'BEGINNER' },
      include: { trainingGoal: true },
    });
  });

  test('updateTrainingPreferences handles optional fields', async () => {
    prisma.user.update.mockResolvedValue({ id: 1 } as any);
    await service.updateTrainingPreferences(1, {} as any);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { trainingGoalId: undefined, experienceLevel: undefined },
      include: { trainingGoal: true },
    });
  });
});