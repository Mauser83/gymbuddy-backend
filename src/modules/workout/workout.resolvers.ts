import type { AuthContext } from "../auth/auth.types";
import { WorkoutService } from "./workout.service";
import { SharingService } from "./workoutSharing.service";
import { PermissionService } from "../core/permission.service";

export const WorkoutResolvers = {
  Workout: {
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
    workouts: async (_: unknown, __: unknown, context: AuthContext) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.getWorkouts(context.userId);
    },

    workoutById: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.getWorkoutById(context.userId, args.id);
    },

    sharedWorkouts: async (_: unknown, __: unknown, context: AuthContext) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.getSharedWorkouts(context.userId);
    },
  },

  Mutation: {
    createWorkout: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.createWorkout(context.userId, args.input);
    },

    updateWorkout: async (
      _: unknown,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.updateWorkout(context.userId, args.id, args.input);
    },

    deleteWorkout: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.deleteWorkout(context.userId, args.id);
    },

    shareWorkout: async (
      _: unknown,
      args: { workoutId: number; shareWithUserId?: number },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.shareWorkout(
        context.userId,
        args.workoutId,
        args.shareWithUserId ?? null
      );
    },

    // ➕ NEW: create version of existing workout plan
    createWorkoutVersion: async (
      _: unknown,
      args: { parentPlanId: number; input: any },
      context: AuthContext
    ) => {
      if (context.userId === null)
        throw new Error("Unauthenticated: userId is null.");
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.createWorkoutVersion(
        context.userId,
        args.parentPlanId,
        args.input
      );
    },
  },
};
