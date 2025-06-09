import type { AuthContext } from "../auth/auth.types";
import { ExerciseLogService } from "./exerciselog.service";
import { PermissionService } from "../core/permission.service";

export const ExerciseLogResolvers = {
  ExerciseLog: {
    workoutSession: (parent: any, _: any, context: AuthContext) => {
      return parent.workoutSessionId
        ? context.prisma.workoutSession.findUnique({
            where: { id: parent.workoutSessionId },
          })
        : null;
    },
    equipmentIds: async (parent: any, _args: any, context: AuthContext) => {
      const records = await context.prisma.exerciseLogEquipment.findMany({
        where: { exerciseLogId: parent.id },
      });
      return records.map((r) => r.gymEquipmentId);
    },
    exercise: async (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.exercise.findUnique({
        where: { id: parent.exerciseId },
      });
    },
    metrics: (parent: any) => parent.metrics,
  },
  WorkoutSession: {
    exerciseLogs: async (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.exerciseLog.findMany({
        where: {
          workoutSessionId: parent.id,
        },
        orderBy: [
          { id: "asc" }, // Fallback to ID if setNumber is missing or tied
        ],
      });
    },
  },

  Query: {
    exerciseLogs: async (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.getExerciseLogs(Number(context.userId));
    },
    workoutSessionById: async (
      _: any,
      { id }: { id: number },
      context: AuthContext
    ) => {
      return context.prisma.workoutSession.findUnique({
        where: { id },
        include: {
          gym: true,
          workoutPlan: true,
        },
      });
    },
    workoutSessionsByUser: async (
      _: any,
      { userId }: { userId: number },
      context: AuthContext
    ) => {
      return context.prisma.workoutSession.findMany({
        where: { userId },
        include: {
          gym: true,
          workoutPlan: true,
        },
      });
    },
    activeWorkoutSession: async (
      _: any,
      { userId }: { userId: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.getActiveWorkoutSession(userId);
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

      return service.updateExerciseLog(args.id, args.input);
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
    createWorkoutSession: async (
      _: any,
      { input }: any,
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.createWorkoutSession(input, Number(context.userId));
    },
    updateWorkoutSession: async (
      _: any,
      { id, input }: any,
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthorized");

      const service = new ExerciseLogService(
        context.prisma,
        new PermissionService(context.prisma)
      );

      return service.updateWorkoutSession(id, input, Number(context.userId));
    },
    deleteWorkoutSession: async (
      _: any,
      { id }: { id: number },
      context: AuthContext
    ) => {
      await context.prisma.exerciseLog.deleteMany({
        where: { workoutSessionId: id },
      }); // cleanup
      await context.prisma.workoutSession.delete({ where: { id } });
      return true;
    },
  },
};
