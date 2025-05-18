import type { AuthContext } from '../auth/auth.types';
import { ExerciseService } from './exercise.service';
import { PermissionService } from '../core/permission.service';

export const ExerciseResolvers = {
  Exercise: {
    // ➕ Linked equipments via ExerciseEquipment
    equipments: async (parent: any, _: any, context: AuthContext) => {
      const links = await context.prisma.exerciseEquipment.findMany({
        where: { exerciseId: parent.id },
        include: { equipment: true },
      });
      return links.map(link => link.equipment);
    },

    // ➕ Linked workout plan entries
    workoutPlanEntries: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { exerciseId: parent.id },
      });
    },
  },

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
