import type { AuthContext } from "../auth/auth.types";
import { WorkoutPlanService } from "./workoutplan.service";
import { SharingService } from "./workoutplanSharing.service";
import { PermissionService } from "../core/permission.service";

export const WorkoutPlanResolvers = {
  WorkoutPlan: {
    exercises: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.workoutPlanExercise.findMany({
        where: { workoutPlanId: parent.id },
        include: { exercise: true },
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

    sharedWorkoutPlans: async (_: unknown, __: unknown, context: AuthContext) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutPlanService = new WorkoutPlanService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutPlanService.getSharedWorkoutPlans(context.userId);
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
      return workoutPlanService.updateWorkoutPlan(context.userId, args.id, args.input);
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

    // ➕ NEW: create version of existing workout plan
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
  },
};
