import type { AuthContext } from "../auth/auth.types";
import { WorkoutService } from "./workout.service";
import { SharingService } from "./workoutSharing.service";
import { PermissionService } from "../core/permission.service";

export const WorkoutResolvers = {
  Query: {
    workouts: async (_: unknown, __: unknown, context: AuthContext) => {
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.getWorkouts(Number(context.userId));
    },
  },
  Mutation: {
    createWorkout: async (
      _: unknown,
      args: { input: any },
      context: AuthContext
    ) => {
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.createWorkout(Number(context.userId), args.input);
    },
    updateWorkout: async (
      _: unknown,
      args: { id: string; input: any },
      context: AuthContext
    ) => {
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.updateWorkout(
        Number(context.userId),
        Number(args.id),
        args.input
      );
    },
    deleteWorkout: async (
      _: unknown,
      args: { id: string },
      context: AuthContext
    ) => {
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.deleteWorkout(
        Number(context.userId),
        Number(args.id)
      );
    },
    shareWorkout: async (
      _: unknown,
      args: { workoutId: string; shareWithUserId?: string },
      context: AuthContext
    ) => {
      const workoutService = new WorkoutService(
        context.prisma,
        new PermissionService(context.prisma),
        new SharingService(context.prisma, context.permissionService)
      );
      return workoutService.shareWorkout(
        Number(context.userId),
        Number(args.workoutId),
        args.shareWithUserId ? Number(args.shareWithUserId) : null
      );
    },
  },
};
