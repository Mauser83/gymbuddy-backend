import { ExerciseLogResolvers } from '../../../src/modules/exerciselog/exerciselog.resolvers';
import { ExerciseLogService } from '../../../src/modules/exerciselog/exerciselog.service';
import { PermissionService } from '../../../src/modules/core/permission.service';

jest.mock('../../../src/modules/exerciselog/exerciselog.service');

const mockedService = jest.mocked(ExerciseLogService);

function createContext() {
  return {
    prisma: {
      workoutSession: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      exerciseLogEquipment: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      exercise: {
        findUnique: jest.fn(),
      },
      exerciseLog: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any,
    userId: 1,
    permissionService: new PermissionService({} as any),
  } as any;
}

describe('ExerciseLogResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
  });

  describe('field resolvers', () => {
    test('workoutSession returns null when missing id', async () => {
      const ctx = createContext();
      const res = await ExerciseLogResolvers.ExerciseLog.workoutSession({ workoutSessionId: null }, {}, ctx);
      expect(res).toBeNull();
      expect(ctx.prisma.workoutSession.findUnique).not.toHaveBeenCalled();
    });

    test('workoutSession fetches when id present', async () => {
      const ctx = createContext();
      ctx.prisma.workoutSession.findUnique.mockResolvedValue({ id: 1 });
      const res = await ExerciseLogResolvers.ExerciseLog.workoutSession({ workoutSessionId: 1 }, {}, ctx);
      expect(ctx.prisma.workoutSession.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toEqual({ id: 1 });
    });

    test('equipmentIds maps ids', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseLogEquipment.findMany.mockResolvedValue([
        { gymEquipmentId: 2 },
      ]);
      const res = await ExerciseLogResolvers.ExerciseLog.equipmentIds({ id: 5 }, {}, ctx);
      expect(ctx.prisma.exerciseLogEquipment.findMany).toHaveBeenCalledWith({ where: { exerciseLogId: 5 } });
      expect(res).toEqual([2]);
    });

    test('exercise fetches by id', async () => {
      const ctx = createContext();
      ctx.prisma.exercise.findUnique.mockResolvedValue({ id: 3 });
      const res = await ExerciseLogResolvers.ExerciseLog.exercise({ exerciseId: 3 }, {}, ctx);
      expect(ctx.prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(res).toEqual({ id: 3 });
    });

    test('metrics returns parent metrics', () => {
      const res = ExerciseLogResolvers.ExerciseLog.metrics({ metrics: { a: 1 } });
      expect(res).toEqual({ a: 1 });
    });

    test('WorkoutSession.exerciseLogs queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseLog.findMany.mockResolvedValue([]);
      await ExerciseLogResolvers.WorkoutSession.exerciseLogs({ id: 2 }, {}, ctx);
      expect(ctx.prisma.exerciseLog.findMany).toHaveBeenCalledWith({
        where: { workoutSessionId: 2 },
        orderBy: [{ id: 'asc' }],
      });
    });
  });

  describe('Query resolvers', () => {
    test('exerciseLogs uses service when authorized', async () => {
      const instance = { getExerciseLogs: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Query.exerciseLogs(null as any, {}, ctx);
      expect(instance.getExerciseLogs).toHaveBeenCalledWith(1);
    });

    test('exerciseLogs throws when unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Query.exerciseLogs(null as any, {}, ctx)).rejects.toThrow('Unauthorized');
    });

    test('workoutSessionById queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.workoutSession.findUnique.mockResolvedValue({});
      await ExerciseLogResolvers.Query.workoutSessionById(null as any, { id: 3 }, ctx);
      expect(ctx.prisma.workoutSession.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        include: { gym: true, workoutPlan: true },
      });
    });

    test('workoutSessionsByUser queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.workoutSession.findMany.mockResolvedValue([]);
      await ExerciseLogResolvers.Query.workoutSessionsByUser(null as any, { userId: 2 }, ctx);
      expect(ctx.prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { userId: 2 },
        include: { gym: true, workoutPlan: true },
      });
    });

    test('activeWorkoutSession uses service when authorized', async () => {
      const instance = { getActiveWorkoutSession: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Query.activeWorkoutSession(null as any, { userId: 1 }, ctx);
      expect(instance.getActiveWorkoutSession).toHaveBeenCalledWith(1);
    });

    test('activeWorkoutSession unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Query.activeWorkoutSession(null as any, { userId: 1 }, ctx)).rejects.toThrow('Unauthorized');
    });
  });

  describe('Mutation resolvers', () => {
    test('createExerciseLog uses service', async () => {
      const instance = { createExerciseLog: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Mutation.createExerciseLog(null as any, { input: {} }, ctx);
      expect(instance.createExerciseLog).toHaveBeenCalled();
    });

    test('createExerciseLog unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Mutation.createExerciseLog(null as any, { input: {} }, ctx)).rejects.toThrow('Unauthorized');
    });

    test('updateExerciseLog uses service', async () => {
      const instance = { updateExerciseLog: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Mutation.updateExerciseLog(null as any, { id: 1, input: {} }, ctx);
      expect(instance.updateExerciseLog).toHaveBeenCalled();
    });

    test('updateExerciseLog unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Mutation.updateExerciseLog(null as any, { id: 1, input: {} }, ctx)).rejects.toThrow('Unauthorized');
    });

    test('deleteExerciseLog uses service', async () => {
      const instance = { deleteExerciseLog: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Mutation.deleteExerciseLog(null as any, { id: 1 }, ctx);
      expect(instance.deleteExerciseLog).toHaveBeenCalled();
    });

    test('deleteExerciseLog unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Mutation.deleteExerciseLog(null as any, { id: 1 }, ctx)).rejects.toThrow('Unauthorized');
    });

    test('createWorkoutSession uses service', async () => {
      const instance = { createWorkoutSession: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Mutation.createWorkoutSession(null as any, { input: {} }, ctx);
      expect(instance.createWorkoutSession).toHaveBeenCalled();
    });

    test('createWorkoutSession unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Mutation.createWorkoutSession(null as any, { input: {} }, ctx)).rejects.toThrow('Unauthorized');
    });

    test('updateWorkoutSession uses service', async () => {
      const instance = { updateWorkoutSession: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseLogResolvers.Mutation.updateWorkoutSession(null as any, { id: 1, input: {} }, ctx);
      expect(instance.updateWorkoutSession).toHaveBeenCalled();
    });

    test('updateWorkoutSession unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(ExerciseLogResolvers.Mutation.updateWorkoutSession(null as any, { id: 1, input: {} }, ctx)).rejects.toThrow('Unauthorized');
    });

    test('deleteWorkoutSession removes records via prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseLog.deleteMany.mockResolvedValue({});
      ctx.prisma.workoutSession.delete.mockResolvedValue({});
      const res = await ExerciseLogResolvers.Mutation.deleteWorkoutSession(null as any, { id: 2 }, ctx);
      expect(ctx.prisma.exerciseLog.deleteMany).toHaveBeenCalledWith({ where: { workoutSessionId: 2 } });
      expect(ctx.prisma.workoutSession.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toBe(true);
    });
  });
});