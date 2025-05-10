import type { AuthContext } from '../auth/auth.types';
import { ExerciseService } from './exercise.service';
import { PermissionService } from '../core/permission.service';

export const ExerciseResolvers = {
  Query: {
    getMyExercises: async (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');

      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getMyExercises(Number(context.userId));
    },
  },

  Mutation: {
    createExercise: async (_: any, args: { input: any }, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');

      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createExercise(args.input, Number(context.userId));
    },

    updateExercise: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error('Unauthorized');

      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateExercise(args.id, args.input, Number(context.userId));
    },

    deleteExercise: async (_: any, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');

      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteExercise(args.id, Number(context.userId));
    },
  },
};
