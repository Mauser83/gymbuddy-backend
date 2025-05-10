import type { AuthContext } from "../auth/auth.types";
import { ExerciseLogService } from "./exerciselog.service";
import { PermissionService } from "../core/permission.service";

export const ExerciseLogResolvers = {
  Query: {
    exerciseLogs: async (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.getExerciseLogs(Number(context.userId));
    },
  },

  Mutation: {
    createExerciseLog: async (
      _parent: any,
      args: { input: any },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.createExerciseLog(args.input, Number(context.userId));
    },

    updateExerciseLog: async (
      _parent: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.updateExerciseLog(args.id, args.input, Number(context.userId));
    },

    deleteExerciseLog: async (
      _parent: any,
      args: { id: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.deleteExerciseLog(args.id, Number(context.userId));
    },
  },
};
