import type { AuthContext } from '../auth/auth.types';
import { ExerciseService } from './exercise.service';
import { PermissionService } from '../core/permission.service';

export const ExerciseResolvers = {
  Exercise: {
    equipments: async (parent: any, _: any, context: AuthContext) => {
      const links = await context.prisma.exerciseEquipment.findMany({
        where: { exerciseId: parent.id },
        include: { equipment: true },
      });
      return links.map(link => link.equipment);
    },

    workoutPlanEntries: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { exerciseId: parent.id },
      });
    },

    // 🔗 New relation: difficulty level
    difficulty: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .difficulty();
    },

    // 🔗 New relation: exercise type
    exerciseType: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .exerciseType();
    },

    // 🔗 New relation: primary muscles
    primaryMuscles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .primaryMuscles({
          include: { bodyPart: true },
        });
    },

    // 🔗 New relation: secondary muscles
    secondaryMuscles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .secondaryMuscles({
          include: { bodyPart: true },
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
