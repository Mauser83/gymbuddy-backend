import {
  CreateExerciseTypeDto,
  UpdateExerciseTypeDto,
  type CreateExerciseSuggestionInput,
  type ApproveExerciseSuggestionInput,
  type RejectExerciseSuggestionInput,
  type ListExerciseSuggestionsInput,
} from './exercise.dto';
import { ExerciseService } from './exercise.service';
import { ExerciseQueryFilters } from './exercise.types';
import { verifyGymScope, verifyRoles } from '../auth/auth.roles';
import type { AuthContext } from '../auth/auth.types';
import { PermissionService } from '../core/permission.service';

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
        orderBy: { slotIndex: 'asc' },
      });
      return slots;
    },

    workoutPlanEntries: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { exerciseId: parent.id },
      });
    },

    difficulty: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise.findUnique({ where: { id: parent.id } }).difficulty();
    },

    exerciseType: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.exercise.findUnique({ where: { id: parent.id } }).exerciseType();
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

  ExerciseSuggestion: {
    equipmentSlots: (parent: any) => parent.equipmentSlots ?? [],
    secondaryMuscleIds: (parent: any) => parent.secondaryMuscleIds ?? [],
  },

  ExerciseType: {
    orderedMetrics: async (parent: any, _: any, context: AuthContext) => {
      const joinRows = await context.prisma.exerciseTypeMetric.findMany({
        where: { exerciseTypeId: parent.id },
        include: {
          metric: true,
        },
        orderBy: { order: 'asc' },
      });

      return joinRows.map((row) => ({
        metric: row.metric,
        order: row.order,
      }));
    },
  },

  Query: {
    getExercises: async (
      _: unknown,
      args: {
        search?: string;
        filters?: ExerciseQueryFilters;
      },
      context: AuthContext,
    ) => {
      const exerciseService = new ExerciseService(
        context.prisma,
        new PermissionService(context.prisma),
      );

      return exerciseService.getExercises(args.search, args.filters);
    },
    getExerciseById: async (_: any, { id }: { id: number }, context: AuthContext) => {
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
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

    musclesByBodyPart: (_: any, args: { bodyPartId: number }, context: AuthContext) => {
      return context.prisma.muscle.findMany({
        where: { bodyPartId: args.bodyPartId },
        include: { bodyPart: true },
      });
    },

    exercisesAvailableAtGym: async (
      _: unknown,
      args: { gymId: number; search?: string },
      context: AuthContext,
    ) => {
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.getExercisesAvailableAtGym(args.gymId);
    },

    allMetrics: (_: any, __: any, context: AuthContext) => {
      return context.prisma.metric.findMany();
    },

    metricById: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.metric.findUnique({ where: { id: args.id } });
    },
    listExerciseSuggestions: async (
      _: any,
      { input }: { input: ListExerciseSuggestionsInput },
      context: AuthContext,
    ) => {
      verifyRoles(context, { or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }] });
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.listExerciseSuggestions(input);
    },
  },

  Mutation: {
    createExercise: async (_: any, args: { input: any }, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.createExercise(context, args.input, Number(context.userId));
    },

    updateExercise: async (_: any, args: { id: number; input: any }, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.updateExercise(args.id, args.input, Number(context.userId));
    },

    deleteExercise: async (_: any, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error('Unauthorized');
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.deleteExercise(args.id, Number(context.userId));
    },

    // --- ExerciseType ---
    createExerciseType: async (
      _: unknown,
      { input }: { input: CreateExerciseTypeDto },
      context: AuthContext,
    ) => {
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.createExerciseType(input);
    },

    updateExerciseType: async (
      _: unknown,
      { id, input }: { id: number; input: UpdateExerciseTypeDto },
      context: AuthContext,
    ) => {
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.updateExerciseType(id, input);
    },
    deleteExerciseType: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.exerciseType.delete({ where: { id: args.id } }).then(() => true);
    },

    // --- ExerciseDifficulty ---
    createExerciseDifficulty: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.exerciseDifficulty.create({ data: args.input });
    },
    updateExerciseDifficulty: (_: any, args: { id: number; input: any }, context: AuthContext) => {
      return context.prisma.exerciseDifficulty.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteExerciseDifficulty: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.exerciseDifficulty.delete({ where: { id: args.id } }).then(() => true);
    },

    // --- BodyPart ---
    createBodyPart: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.bodyPart.create({ data: args.input });
    },
    updateBodyPart: (_: any, args: { id: number; input: any }, context: AuthContext) => {
      return context.prisma.bodyPart.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteBodyPart: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.bodyPart.delete({ where: { id: args.id } }).then(() => true);
    },

    // --- Muscle ---
    createMuscle: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.muscle.create({ data: args.input });
    },
    updateMuscle: (_: any, args: { id: number; input: any }, context: AuthContext) => {
      return context.prisma.muscle.update({
        where: { id: args.id },
        data: args.input,
      });
    },
    deleteMuscle: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.muscle.delete({ where: { id: args.id } }).then(() => true);
    },

    createMetric: (_: any, args: { input: any }, context: AuthContext) => {
      return context.prisma.metric.create({ data: args.input });
    },

    updateMetric: (_: any, args: { id: number; input: any }, context: AuthContext) => {
      return context.prisma.metric.update({
        where: { id: args.id },
        data: args.input,
      });
    },

    deleteMetric: (_: any, args: { id: number }, context: AuthContext) => {
      return context.prisma.metric.delete({ where: { id: args.id } }).then(() => true);
    },

    createExerciseSuggestion: async (
      _: any,
      { input }: { input: CreateExerciseSuggestionInput },
      context: AuthContext,
    ) => {
      if (!context.userId) throw new Error('Unauthorized');
      const permissionService = new PermissionService(context.prisma);
      if (input.gymId) {
        verifyGymScope(context, permissionService, input.gymId);
      }
      const service = new ExerciseService(context.prisma, permissionService);
      return service.createExerciseSuggestion(Number(context.userId), input);
    },

    approveExerciseSuggestion: async (
      _: any,
      { input }: { input: ApproveExerciseSuggestionInput },
      context: AuthContext,
    ) => {
      verifyRoles(context, { or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }] });
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.approveExerciseSuggestion(context, input);
    },

    rejectExerciseSuggestion: async (
      _: any,
      { input }: { input: RejectExerciseSuggestionInput },
      context: AuthContext,
    ) => {
      verifyRoles(context, { or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }] });
      const service = new ExerciseService(context.prisma, new PermissionService(context.prisma));
      return service.rejectExerciseSuggestion(input);
    },
  },
};
