import { UserService } from './user.service';
import { pubsub } from '../../graphql/rootResolvers';
import type { AuthContext } from '../auth/auth.types';

export const UserResolvers = {
  User: {
    gymManagementRoles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.gymManagementRole.findMany({
        where: { userId: parent.id },
        include: { gym: true },
      });
    },

    // ➕ NEW: assigned workouts this user received
    assignedWorkouts: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.assignedWorkout.findMany({
        where: { assigneeId: parent.id },
        include: { workoutPlan: true },
      });
    },

    // ➕ NEW: workouts this user (as trainer) assigned
    assignedByWorkouts: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.assignedWorkout.findMany({
        where: { trainerId: parent.id },
        include: { assignee: true, workoutPlan: true },
      });
    },

    // ➕ NEW: sessions created by this user
    workoutSessions: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutSession.findMany({
        where: { userId: parent.id },
        orderBy: { startedAt: 'desc' },
      });
    },

    trainingGoal: (parent: any, _: any, context: AuthContext) => {
      if (!parent.trainingGoalId) return null;
      return context.prisma.trainingGoal.findUnique({
        where: { id: parent.trainingGoalId },
      });
    },
  },

  Query: {
    users: async (_: unknown, args: { search?: string }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      return userService.searchUsers(context, args.search);
    },

    userById: async (_: unknown, args: { id: number }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      return userService.getUserById(context, args.id);
    },
  },

  Mutation: {
    deleteUser: async (_: unknown, args: { id: number }, context: AuthContext) => {
      const userService = new UserService(context.prisma);
      await userService.deleteUser(context, args.id);
      return 'User deleted successfully';
    },

    updateUserRoles: async (
      _: unknown,
      args: { userId: number; input: { appRole?: string; userRole: string } },
      context: AuthContext,
    ) => {
      const userService = new UserService(context.prisma);

      const updatedUser = await userService.updateUserRoles(context, {
        userId: args.userId,
        ...args.input,
      });

      await pubsub.publish('USER_ROLE_UPDATED', {
        userRoleUpdated: updatedUser,
      });
      await pubsub.publish('USER_UPDATED', { userUpdated: updatedUser });

      return updatedUser;
    },

    updateUserTrainingPreferences: async (
      _: unknown,
      args: { input: { trainingGoalId?: number; experienceLevelId?: number } },
      context: AuthContext,
    ) => {
      if (!context.userId) throw new Error('Unauthorized');

      const userService = new UserService(context.prisma);
      const updatedUser = await userService.updateTrainingPreferences(context.userId, {
        trainingGoalId: args.input.trainingGoalId,
        experienceLevelId: args.input.experienceLevelId,
      });

      await pubsub.publish('USER_UPDATED', { userUpdated: updatedUser });

      return updatedUser;
    },
  },
};
