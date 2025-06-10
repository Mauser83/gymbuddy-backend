import type { AuthContext } from "../auth/auth.types";
import { WorkoutPlanService } from "./workoutplan.service";
import { SharingService } from "./workoutplanSharing.service";
import { PermissionService } from "../core/permission.service";
import { UpdateWorkoutPlanDto, UpdateTrainingMethodGoalsDto } from "./workoutplan.dto";

export const WorkoutPlanResolvers = {
  WorkoutPlan: {
    exercises: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { workoutPlanId: parent.id },
        include: { exercise: true, trainingMethod: true },
      });
    },
    trainingGoal: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.trainingGoal.findUnique({
        where: { id: parent.trainingGoalId },
      });
    },
    intensityPreset: (parent: any, _: any, context: AuthContext) => {
      return parent.intensityPresetId
        ? context.prisma.intensityPreset.findUnique({
            where: { id: parent.intensityPresetId },
          })
        : null;
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
    targetMetrics: (parent: any) => parent.targetMetrics ?? [],
    groupId: (parent: any) => parent.groupId ?? null, // ✅ NEW
  },

  IntensityPreset: {
    trainingGoal: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.trainingGoal.findUnique({
        where: { id: parent.trainingGoalId },
      });
    },
  },

  TrainingGoal: {
    trainingMethods: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.trainingMethod.findMany({
        where: {
          trainingGoals: {
            some: { id: parent.id },
          },
        },
      });
    },
  },

  TrainingMethod: {
    trainingGoals: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.trainingGoal.findMany({
        where: {
          trainingMethods: {
            some: { id: parent.id },
          },
        },
      });
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

    getTrainingGoals: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.trainingGoal.findMany({
        include: { presets: true },
      });
    },

    getIntensityPresets: (
      _: unknown,
      args: { trainingGoalId?: number },
      context: AuthContext
    ) => {
      return context.prisma.intensityPreset.findMany({
        where: args.trainingGoalId
          ? { trainingGoalId: args.trainingGoalId }
          : {},
      });
    },
    getMuscleGroups: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.muscleGroup.findMany({
        include: { bodyParts: true }, // ✅ include relation
      });
    },
    getTrainingMethods: (_: unknown, __: unknown, context: AuthContext) => {
      return context.prisma.trainingMethod.findMany();
    },

    getTrainingMethodsByGoal: async (
      _: unknown,
      args: { goalId: number },
      context: AuthContext
    ) => {
      return context.prisma.trainingMethod.findMany({
        where: {
          trainingGoals: {
            some: {
              id: args.goalId,
            },
          },
        },
      });
    },

    getWorkoutPrograms: async (
      _: unknown,
      __: unknown,
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.getWorkoutPrograms(context.userId);
    },

    getWorkoutProgramById: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.getWorkoutProgramById(context.userId, args.id);
    },

    getUserWorkoutPreferences: async (
      _: unknown,
      __: unknown,
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.getUserWorkoutPreferences(context.userId);
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
      args: { id: number; input: UpdateWorkoutPlanDto },
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

    createTrainingGoal: (_: unknown, { input }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createTrainingGoal(context, input);
    },

    updateTrainingGoal: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateTrainingGoal(context, id, input);
    },

    deleteTrainingGoal: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteTrainingGoal(context, id);
    },

    createIntensityPreset: (
      _: unknown,
      { input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createIntensityPreset(context, input);
    },

    updateIntensityPreset: (
      _: unknown,
      { id, input }: any,
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateIntensityPreset(context, id, input);
    },

    deleteIntensityPreset: (_: unknown, { id }: any, context: AuthContext) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteIntensityPreset(context, id);
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

    createWorkoutProgram: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutProgram(context.userId, args.input);
    },

    updateWorkoutProgram: async (
      _: unknown,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateWorkoutProgram(context.userId, args.id, args.input);
    },

    deleteWorkoutProgram: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutProgram(context.userId, args.id);
    },

    createWorkoutProgramDay: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutProgramDay(context.userId, args.input);
    },

    updateWorkoutProgramDay: async (
      _: unknown,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateWorkoutProgramDay(
        context.userId,
        args.id,
        args.input
      );
    },

    deleteWorkoutProgramDay: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutProgramDay(context.userId, args.id);
    },

    createWorkoutProgramCooldown: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutProgramCooldown(context.userId, args.input);
    },

    deleteWorkoutProgramCooldown: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutProgramCooldown(context.userId, args.id);
    },

    createWorkoutProgramAssignment: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.createWorkoutProgramAssignment(context.userId, args.input);
    },

    deleteWorkoutProgramAssignment: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.deleteWorkoutProgramAssignment(context.userId, args.id);
    },

    setUserWorkoutPreferences: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.setUserWorkoutPreferences(context.userId, args.input);
    },

    shareWorkoutProgram: async (
      _: unknown,
      args: { programId: number; shareWithUserId?: number },
      context: AuthContext
    ) => {
      if (context.userId === null) throw new Error("Unauthenticated");
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.shareWorkoutProgram(
        context.userId,
        args.programId,
        args.shareWithUserId ?? null
      );
    },

    updateTrainingMethodGoals: async (
      _: unknown,
      args: { input: UpdateTrainingMethodGoalsDto },
      context: AuthContext
    ) => {
      const service = new WorkoutPlanService(
        context.prisma,
        context.permissionService,
        new SharingService(context.prisma, context.permissionService)
      );
      return service.updateTrainingMethodGoals(context, args.input);
    },
  },
};
