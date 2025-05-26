import type { AuthContext } from "../auth/auth.types";
import { WorkoutPlanService } from "./workoutplan.service";
import { SharingService } from "./workoutplanSharing.service";
import { PermissionService } from "../core/permission.service";

export const WorkoutPlanResolvers = {
  WorkoutPlan: {
    exercises: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { workoutPlanId: parent.id },
        include: { exercise: true, trainingMethod: true },
      });
    },
    workoutType: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutType.findUnique({
        where: { id: parent.workoutTypeId },
        include: { category: true },
      });
    },
    muscleGroups: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.muscleGroup.findMany({
        where: {
          plans: {
            some: { id: parent.id },
          },
        },
      });
    },
    assignedWorkouts: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.assignedWorkout.findMany({
        where: { workoutPlanId: parent.id },
      });
    },
    sessions: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutSession.findMany({
        where: { workoutPlanId: parent.id },
      });
    },
  },

  WorkoutPlanExercise: {
    trainingMethod: (parent: any, _: any, context: AuthContext) => {
      return parent.trainingMethodId
        ? context.prisma.trainingMethod.findUnique({
            where: { id: parent.trainingMethodId },
          })
        : null;
    },
  },

  Query: {
    workoutPlans: async (_: unknown, __: unknown, context: AuthContext) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.getWorkoutPlans(context.userId);
    },

    workoutPlanById: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.getWorkoutPlanById(context.userId, args.id);
    },

    sharedWorkoutPlans: async (
      _: unknown,
      __: unknown,
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.getSharedWorkoutPlans(context.userId);
    },

    getWorkoutCategories: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.workoutCategory.findMany({
        include: { types: true },
      });
    },
    getWorkoutTypes: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.workoutType.findMany({
        include: { category: true },
      });
    },
    getMuscleGroups: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.muscleGroup.findMany();
    },
    getTrainingMethods: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.trainingMethod.findMany();
    },
  },

  Mutation: {
    createWorkoutPlan: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.createWorkoutPlan(context.userId, args.input);
    },

    updateWorkoutPlan: async (
      _: unknown,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.updateWorkoutPlan(
        context.userId,
        args.id,
        args.input
      );
    },

    deleteWorkoutPlan: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.deleteWorkoutPlan(context.userId, args.id);
    },

    shareWorkoutPlan: async (
      _: unknown,
      args: { workoutId: number; shareWithUserId?: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.shareWorkoutPlan(
        context.userId,
        args.workoutId,
        args.shareWithUserId ?? null
      );
    },

    createWorkoutPlanVersion: async (
      _: unknown,
      args: { parentPlanId: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.createWorkoutPlanVersion(
        context.userId,
        args.parentPlanId,
        args.input
      );
    },

    // 🔒 WorkoutCategory
    createWorkoutCategory: (
      _: unknown,
      { input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutCategory(context, input);
    },

    updateWorkoutCategory: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateWorkoutCategory(context, id, input);
    },

    deleteWorkoutCategory: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutCategory(context, id);
    },

    // 🔒 WorkoutType
    createWorkoutType: (_: unknown, { input }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutType(context, input);
    },

    updateWorkoutType: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateWorkoutType(context, id, input);
    },

    deleteWorkoutType: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutType(context, id);
    },

    // 🔒 MuscleGroup
    createMuscleGroup: (_: unknown, { input }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createMuscleGroup(context, input);
    },

    updateMuscleGroup: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateMuscleGroup(context, id, input);
    },

    deleteMuscleGroup: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteMuscleGroup(context, id);
    },

    // 🔒 TrainingMethod
    createTrainingMethod: (
      _: unknown,
      { input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createTrainingMethod(context, input);
    },

    updateTrainingMethod: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateTrainingMethod(context, id, input);
    },

    deleteTrainingMethod: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteTrainingMethod(context, id);
    },
  },
};
