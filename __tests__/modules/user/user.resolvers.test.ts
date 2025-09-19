import { UserResolvers } from '../../../src/modules/user/user.resolvers';
import { UserService } from '../../../src/modules/user/user.service';
import { pubsub } from '../../../src/graphql/rootResolvers';
import { PermissionService } from '../../../src/modules/core/permission.service';

jest.mock('../../../src/modules/user/user.service');
jest.mock('../../../src/graphql/rootResolvers', () => ({ pubsub: { publish: jest.fn() } }));

const mockedService = jest.mocked(UserService);
const mockedPublish = jest.mocked(pubsub.publish);

function createContext() {
  return {
    prisma: {
      gymManagementRole: { findMany: jest.fn() },
      assignedWorkout: { findMany: jest.fn() },
      workoutSession: { findMany: jest.fn() },
      trainingGoal: { findUnique: jest.fn() },
    } as any,
    userId: 1,
    appRole: 'ADMIN',
    permissionService: new PermissionService({} as any),
  } as any;
}

describe('UserResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
    mockedPublish.mockClear();
  });

  describe('field resolvers', () => {
    test('gymManagementRoles returns list', async () => {
      const ctx = createContext();
      ctx.prisma.gymManagementRole.findMany.mockResolvedValue([]);
      await UserResolvers.User.gymManagementRoles({ id: 2 }, {}, ctx);
      expect(ctx.prisma.gymManagementRole.findMany).toHaveBeenCalledWith({
        where: { userId: 2 },
        include: { gym: true },
      });
    });

    test('assignedWorkouts queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.assignedWorkout.findMany.mockResolvedValue([]);
      await UserResolvers.User.assignedWorkouts({ id: 1 }, {}, ctx);
      expect(ctx.prisma.assignedWorkout.findMany).toHaveBeenCalledWith({
        where: { assigneeId: 1 },
        include: { workoutPlan: true },
      });
    });

    test('assignedByWorkouts queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.assignedWorkout.findMany.mockResolvedValue([]);
      await UserResolvers.User.assignedByWorkouts({ id: 1 }, {}, ctx);
      expect(ctx.prisma.assignedWorkout.findMany).toHaveBeenCalledWith({
        where: { trainerId: 1 },
        include: { assignee: true, workoutPlan: true },
      });
    });

    test('workoutSessions queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.workoutSession.findMany.mockResolvedValue([]);
      await UserResolvers.User.workoutSessions({ id: 3 }, {}, ctx);
      expect(ctx.prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 3 },
        orderBy: { startedAt: 'desc' },
      });
    });

    test('trainingGoal returns null when not set', async () => {
      const ctx = createContext();
      const res = await UserResolvers.User.trainingGoal({ id: 1 }, {}, ctx);
      expect(res).toBeNull();
      expect(ctx.prisma.trainingGoal.findUnique).not.toHaveBeenCalled();
    });

    test('trainingGoal queries prisma when id present', async () => {
      const ctx = createContext();
      ctx.prisma.trainingGoal.findUnique.mockResolvedValue({ id: 5 });
      const res = await UserResolvers.User.trainingGoal({ id: 1, trainingGoalId: 5 }, {}, ctx);
      expect(ctx.prisma.trainingGoal.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(res).toEqual({ id: 5 });
    });
  });

  describe('Query resolvers', () => {
    test('users uses service', async () => {
      const instance = { searchUsers: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await UserResolvers.Query.users(null as any, { search: 'a' }, ctx);
      expect(instance.searchUsers).toHaveBeenCalledWith(ctx, 'a');
    });

    test('userById uses service', async () => {
      const instance = { getUserById: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await UserResolvers.Query.userById(null as any, { id: 3 }, ctx);
      expect(instance.getUserById).toHaveBeenCalledWith(ctx, 3);
    });
  });

  describe('Mutation resolvers', () => {
    test('deleteUser uses service', async () => {
      const instance = { deleteUser: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const res = await UserResolvers.Mutation.deleteUser(null as any, { id: 4 }, ctx);
      expect(instance.deleteUser).toHaveBeenCalledWith(ctx, 4);
      expect(res).toBe('User deleted successfully');
    });

    test('updateUserRoles publishes events', async () => {
      const instance = { updateUserRoles: jest.fn().mockResolvedValue({ id: 1 }) } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const res = await UserResolvers.Mutation.updateUserRoles(
        null as any,
        { userId: 1, input: { appRole: 'ADMIN', userRole: 'USER' } },
        ctx,
      );
      expect(instance.updateUserRoles).toHaveBeenCalledWith(ctx, {
        userId: 1,
        appRole: 'ADMIN',
        userRole: 'USER',
      });
      expect(mockedPublish).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ id: 1 });
    });

    test('updateUserTrainingPreferences requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        UserResolvers.Mutation.updateUserTrainingPreferences(null as any, { input: {} }, ctx),
      ).rejects.toThrow('Unauthorized');
    });

    test('updateUserTrainingPreferences uses service', async () => {
      const instance = { updateTrainingPreferences: jest.fn().mockResolvedValue({ id: 2 }) } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const res = await UserResolvers.Mutation.updateUserTrainingPreferences(
        null as any,
        { input: { trainingGoalId: 1, experienceLevelId: 2 } },
        ctx,
      );
      expect(instance.updateTrainingPreferences).toHaveBeenCalledWith(1, {
        trainingGoalId: 1,
        experienceLevelId: 2,
      });
      expect(mockedPublish).toHaveBeenCalledWith('USER_UPDATED', { userUpdated: { id: 2 } });
      expect(res).toEqual({ id: 2 });
    });
  });
});
