import type { AuthContext } from "../auth/auth.types";
import { WorkoutService } from "./workout.service";
import { SharingService } from "./workoutSharing.service";
import { PermissionService } from "../core/permission.service";

export const WorkoutResolvers = {
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
        args.shareWithUserId ? args.shareWithUserId : null
      );
    },
  },
};
