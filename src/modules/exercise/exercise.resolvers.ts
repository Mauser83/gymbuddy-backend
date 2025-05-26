import type { AuthContext } from "../auth/auth.types";
import { ExerciseService } from "./exercise.service";
import { PermissionService } from "../core/permission.service";
import { ExerciseQueryFilters } from "./exercise.types";

export const ExerciseResolvers = {
  Exercise: {
    equipmentSlots: async (parent: any, _: any, context: AuthContext) => {
      const slots = await context.prisma.exerciseEquipmentSlot.findMany({
        where: { exerciseId: parent.id },
        include: {
          options: {
            include: {
              subcategory: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
        orderBy: { slotIndex: "asc" },
      });
      return slots;
    },

    workoutPlanEntries: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { exerciseId: parent.id },
      });
    },

    difficulty: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .difficulty();
    },

    exerciseType: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .exerciseType();
    },

    primaryMuscles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .primaryMuscles({ include: { bodyPart: true } });
    },

    secondaryMuscles: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise
        .findUnique({ where: { id: parent.id } })
        .secondaryMuscles({ include: { bodyPart: true } });
    },
  },

  Query: {
    getExercises: async (
      _: unknown,
      args: {
        search?: string;
        filters?: ExerciseQueryFilters;
      },
      context: AuthContext
    ) => {
      const exerciseService = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return exerciseService.getExercises(args.search, args.filters);
    },
    getExerciseById: async (
      _: any,
      { id }: { id: number },
      context: AuthContext
    ) => {
      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getExerciseById(id);
    },

    allExerciseTypes: (_: any, __: any, context: AuthContext) => {
      return context.prisma.exerciseType.findMany();
    },

    allExerciseDifficulties: (_: any, __: any, context: AuthContext) => {
      return context.prisma.exerciseDifficulty.findMany();
    },

    allBodyParts: (_: any, __: any, context: AuthContext) => {
      return context.prisma.bodyPart.findMany({
        include: { muscles: { include: { bodyPart: true } } },
      });
    },

    musclesByBodyPart: (
      _: any,
      args: { bodyPartId: number },
      context: AuthContext
    ) => {
      return context.prisma.muscle.findMany({
        where: { bodyPartId: args.bodyPartId },
        include: { bodyPart: true },
      });
    },

    exercisesAvailableAtGym: async (
      _: unknown,
      args: { gymId: number; search?: string },
      context: AuthContext
    ) => {
      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getExercisesAvailableAtGym(args.gymId);
    },
  },

  Mutation: {
    createExercise: async (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");
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
      if (!context.userId) throw new Error("Unauthorized");
      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateExercise(
        args.id,
        args.input,
        Number(context.userId)
      );
    },

    deleteExercise: async (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");
      const service = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteExercise(args.id, Number(context.userId));
    },

    // --- ExerciseType ---
    createExerciseType: (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      return context.prisma.exerciseType.create({ data: args.input });
    },
    updateExerciseType: (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      return context.prisma.exerciseType.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteExerciseType: (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      return context.prisma.exerciseType
        .delete({ where: { id: args.id } })
        .then(() => true);
    },

    // --- ExerciseDifficulty ---
    createExerciseDifficulty: (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      return context.prisma.exerciseDifficulty.create({ data: args.input });
    },
    updateExerciseDifficulty: (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      return context.prisma.exerciseDifficulty.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteExerciseDifficulty: (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      return context.prisma.exerciseDifficulty
        .delete({ where: { id: args.id } })
        .then(() => true);
    },

    // --- BodyPart ---
    createBodyPart: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.bodyPart.create({ data: args.input });
    },
    updateBodyPart: (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      return context.prisma.bodyPart.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteBodyPart: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.bodyPart
        .delete({ where: { id: args.id } })
        .then(() => true);
    },

    // --- Muscle ---
    createMuscle: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.muscle.create({ data: args.input });
    },
    updateMuscle: (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      return context.prisma.muscle.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteMuscle: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.muscle
        .delete({ where: { id: args.id } })
        .then(() => true);
    },
  },
};
