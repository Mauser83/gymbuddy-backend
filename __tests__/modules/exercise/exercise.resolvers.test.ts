import { verifyRoles, verifyGymScope } from '../../../src/modules/auth/auth.roles';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { ExerciseResolvers } from '../../../src/modules/exercise/exercise.resolvers';
import { ExerciseService } from '../../../src/modules/exercise/exercise.service';

jest.mock('../../../src/modules/exercise/exercise.service');
jest.mock('../../../src/modules/auth/auth.roles', () => ({
  verifyRoles: jest.fn(),
  verifyGymScope: jest.fn(),
}));

const mockedService = jest.mocked(ExerciseService);
const mockedVerifyRoles = jest.mocked(verifyRoles);
const mockedVerifyGymScope = jest.mocked(verifyGymScope);

function createContext() {
  return {
    prisma: {
      exerciseEquipmentSlot: { findMany: jest.fn() },
      workoutPlanExercise: { findMany: jest.fn() },
      exercise: { findUnique: jest.fn() },
      exerciseTypeMetric: { findMany: jest.fn() },
      exerciseType: { findMany: jest.fn(), delete: jest.fn() },
      exerciseDifficulty: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bodyPart: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      muscle: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      metric: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any,
    userId: 1,
    permissionService: new PermissionService({} as any),
  } as any;
}

describe('ExerciseResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
    mockedVerifyRoles.mockClear();
    mockedVerifyGymScope.mockClear();
  });

  describe('field resolvers', () => {
    test('Exercise.equipmentSlots', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseEquipmentSlot.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Exercise.equipmentSlots({ id: 1 }, {}, ctx);
      expect(ctx.prisma.exerciseEquipmentSlot.findMany).toHaveBeenCalledWith({
        where: { exerciseId: 1 },
        include: { options: { include: { subcategory: { include: { category: true } } } } },
        orderBy: { slotIndex: 'asc' },
      });
    });

    test('Exercise.workoutPlanEntries', async () => {
      const ctx = createContext();
      ctx.prisma.workoutPlanExercise.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Exercise.workoutPlanEntries({ id: 2 }, {}, ctx);
      expect(ctx.prisma.workoutPlanExercise.findMany).toHaveBeenCalledWith({
        where: { exerciseId: 2 },
      });
    });

    test('Exercise.difficulty', async () => {
      const diffFn = jest.fn();
      const ctx = createContext();
      ctx.prisma.exercise.findUnique.mockReturnValue({ difficulty: diffFn } as any);
      await ExerciseResolvers.Exercise.difficulty({ id: 3 }, {}, ctx);
      expect(ctx.prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(diffFn).toHaveBeenCalled();
    });

    test('Exercise.exerciseType', async () => {
      const fn = jest.fn();
      const ctx = createContext();
      ctx.prisma.exercise.findUnique.mockReturnValue({ exerciseType: fn } as any);
      await ExerciseResolvers.Exercise.exerciseType({ id: 3 }, {}, ctx);
      expect(ctx.prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(fn).toHaveBeenCalled();
    });

    test('Exercise.primaryMuscles', async () => {
      const fn = jest.fn();
      const ctx = createContext();
      ctx.prisma.exercise.findUnique.mockReturnValue({ primaryMuscles: fn } as any);
      await ExerciseResolvers.Exercise.primaryMuscles({ id: 3 }, {}, ctx);
      expect(ctx.prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(fn).toHaveBeenCalledWith({ include: { bodyPart: true } });
    });

    test('Exercise.secondaryMuscles', async () => {
      const fn = jest.fn();
      const ctx = createContext();
      ctx.prisma.exercise.findUnique.mockReturnValue({ secondaryMuscles: fn } as any);
      await ExerciseResolvers.Exercise.secondaryMuscles({ id: 3 }, {}, ctx);
      expect(ctx.prisma.exercise.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(fn).toHaveBeenCalledWith({ include: { bodyPart: true } });
    });

    test('ExerciseType.orderedMetrics', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseTypeMetric.findMany.mockResolvedValue([{ metric: 'm', order: 1 }]);
      const res = await ExerciseResolvers.ExerciseType.orderedMetrics({ id: 1 }, {}, ctx);
      expect(ctx.prisma.exerciseTypeMetric.findMany).toHaveBeenCalledWith({
        where: { exerciseTypeId: 1 },
        include: { metric: true },
        orderBy: { order: 'asc' },
      });
      expect(res).toEqual([{ metric: 'm', order: 1 }]);
    });
  });

  describe('Query resolvers', () => {
    test('getExercises uses service', async () => {
      const instance = { getExercises: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Query.getExercises(null as any, { search: 'a', filters: {} }, ctx);
      expect(instance.getExercises).toHaveBeenCalled();
    });

    test('getExerciseById uses service', async () => {
      const instance = { getExerciseById: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Query.getExerciseById(null as any, { id: 1 }, ctx);
      expect(instance.getExerciseById).toHaveBeenCalledWith(1);
    });

    test('allExerciseTypes queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseType.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Query.allExerciseTypes(null as any, {}, ctx);
      expect(ctx.prisma.exerciseType.findMany).toHaveBeenCalled();
    });

    test('allExerciseDifficulties queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseDifficulty.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Query.allExerciseDifficulties(null as any, {}, ctx);
      expect(ctx.prisma.exerciseDifficulty.findMany).toHaveBeenCalled();
    });

    test('allBodyParts queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.bodyPart.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Query.allBodyParts(null as any, {}, ctx);
      expect(ctx.prisma.bodyPart.findMany).toHaveBeenCalledWith({
        include: { muscles: { include: { bodyPart: true } } },
      });
    });

    test('musclesByBodyPart queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.muscle.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Query.musclesByBodyPart(null as any, { bodyPartId: 2 }, ctx);
      expect(ctx.prisma.muscle.findMany).toHaveBeenCalledWith({
        where: { bodyPartId: 2 },
        include: { bodyPart: true },
      });
    });

    test('exercisesAvailableAtGym uses service', async () => {
      const instance = { getExercisesAvailableAtGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Query.exercisesAvailableAtGym(null as any, { gymId: 1 }, ctx);
      expect(instance.getExercisesAvailableAtGym).toHaveBeenCalledWith(1);
    });

    test('allMetrics queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.metric.findMany.mockResolvedValue([]);
      await ExerciseResolvers.Query.allMetrics(null as any, {}, ctx);
      expect(ctx.prisma.metric.findMany).toHaveBeenCalled();
    });

    test('metricById queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.metric.findUnique.mockResolvedValue({});
      await ExerciseResolvers.Query.metricById(null as any, { id: 3 }, ctx);
      expect(ctx.prisma.metric.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    });

    test('listExerciseSuggestions requires roles and uses service', async () => {
      const instance = { listExerciseSuggestions: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const input = { status: 'PENDING' } as any;

      await ExerciseResolvers.Query.listExerciseSuggestions(null as any, { input }, ctx);

      expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      });
      expect(instance.listExerciseSuggestions).toHaveBeenCalledWith(input);
    });
  });

  describe('Mutation resolvers', () => {
    test('createExercise uses service', async () => {
      const instance = { createExercise: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Mutation.createExercise(null as any, { input: {} }, ctx);
      expect(instance.createExercise).toHaveBeenCalled();
    });

    test('createExercise throws when unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        ExerciseResolvers.Mutation.createExercise(null as any, { input: {} }, ctx),
      ).rejects.toThrow('Unauthorized');
    });

    test('createExerciseSuggestion throws when unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;

      await expect(
        ExerciseResolvers.Mutation.createExerciseSuggestion(null as any, { input: {} as any }, ctx),
      ).rejects.toThrow('Unauthorized');
    });

    test('createExerciseSuggestion uses service', async () => {
      const instance = { createExerciseSuggestion: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      ctx.userId = 42;
      const input = { exercise: { name: 'x' } } as any;

      await ExerciseResolvers.Mutation.createExerciseSuggestion(null as any, { input }, ctx);

      expect(mockedVerifyGymScope).not.toHaveBeenCalled();
      expect(instance.createExerciseSuggestion).toHaveBeenCalledWith(42, input);
    });

    test('createExerciseSuggestion checks gym scope when gymId provided', async () => {
      const instance = { createExerciseSuggestion: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      ctx.userId = 7;
      const input = { gymId: 55, exercise: { name: 'y' } } as any;

      await ExerciseResolvers.Mutation.createExerciseSuggestion(null as any, { input }, ctx);

      expect(mockedVerifyGymScope).toHaveBeenCalledWith(ctx, expect.any(PermissionService), 55);
      expect(instance.createExerciseSuggestion).toHaveBeenCalledWith(7, input);
    });

    test('updateExercise uses service', async () => {
      const instance = { updateExercise: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Mutation.updateExercise(null as any, { id: 1, input: {} }, ctx);
      expect(instance.updateExercise).toHaveBeenCalled();
    });

    test('updateExercise unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        ExerciseResolvers.Mutation.updateExercise(null as any, { id: 1, input: {} }, ctx),
      ).rejects.toThrow('Unauthorized');
    });

    test('deleteExercise uses service', async () => {
      const instance = { deleteExercise: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Mutation.deleteExercise(null as any, { id: 1 }, ctx);
      expect(instance.deleteExercise).toHaveBeenCalled();
    });

    test('deleteExercise unauthorized', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        ExerciseResolvers.Mutation.deleteExercise(null as any, { id: 1 }, ctx),
      ).rejects.toThrow('Unauthorized');
    });

    test('approveExerciseSuggestion requires roles and uses service', async () => {
      const instance = { approveExerciseSuggestion: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const input = { id: 's1' } as any;

      await ExerciseResolvers.Mutation.approveExerciseSuggestion(null as any, { input }, ctx);

      expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      });
      expect(instance.approveExerciseSuggestion).toHaveBeenCalledWith(ctx, input);
    });

    test('rejectExerciseSuggestion requires roles and uses service', async () => {
      const instance = { rejectExerciseSuggestion: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      const input = { id: 's1' } as any;

      await ExerciseResolvers.Mutation.rejectExerciseSuggestion(null as any, { input }, ctx);

      expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      });
      expect(instance.rejectExerciseSuggestion).toHaveBeenCalledWith(input);
    });

    test('createExerciseType uses service', async () => {
      const instance = { createExerciseType: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Mutation.createExerciseType(null as any, { input: {} as any }, ctx);
      expect(instance.createExerciseType).toHaveBeenCalled();
    });

    test('updateExerciseType uses service', async () => {
      const instance = { updateExerciseType: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await ExerciseResolvers.Mutation.updateExerciseType(
        null as any,
        { id: 1, input: {} as any },
        ctx,
      );
      expect(instance.updateExerciseType).toHaveBeenCalled();
    });

    test('deleteExerciseType uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseType.delete.mockResolvedValue({});
      const res = await ExerciseResolvers.Mutation.deleteExerciseType(null as any, { id: 2 }, ctx);
      expect(ctx.prisma.exerciseType.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toBe(true);
    });

    test('createExerciseDifficulty uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseDifficulty.create.mockResolvedValue({});
      await ExerciseResolvers.Mutation.createExerciseDifficulty(null as any, { input: {} }, ctx);
      expect(ctx.prisma.exerciseDifficulty.create).toHaveBeenCalled();
    });

    test('updateExerciseDifficulty uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseDifficulty.update.mockResolvedValue({});
      await ExerciseResolvers.Mutation.updateExerciseDifficulty(
        null as any,
        { id: 1, input: {} },
        ctx,
      );
      expect(ctx.prisma.exerciseDifficulty.update).toHaveBeenCalled();
    });

    test('deleteExerciseDifficulty uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.exerciseDifficulty.delete.mockResolvedValue({});
      const res = await ExerciseResolvers.Mutation.deleteExerciseDifficulty(
        null as any,
        { id: 1 },
        ctx,
      );
      expect(ctx.prisma.exerciseDifficulty.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toBe(true);
    });

    test('createBodyPart uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.bodyPart.create.mockResolvedValue({});
      await ExerciseResolvers.Mutation.createBodyPart(null as any, { input: {} }, ctx);
      expect(ctx.prisma.bodyPart.create).toHaveBeenCalled();
    });

    test('updateBodyPart uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.bodyPart.update.mockResolvedValue({});
      await ExerciseResolvers.Mutation.updateBodyPart(null as any, { id: 1, input: {} }, ctx);
      expect(ctx.prisma.bodyPart.update).toHaveBeenCalled();
    });

    test('deleteBodyPart uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.bodyPart.delete.mockResolvedValue({});
      const res = await ExerciseResolvers.Mutation.deleteBodyPart(null as any, { id: 2 }, ctx);
      expect(ctx.prisma.bodyPart.delete).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toBe(true);
    });

    test('createMuscle uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.muscle.create.mockResolvedValue({});
      await ExerciseResolvers.Mutation.createMuscle(null as any, { input: {} }, ctx);
      expect(ctx.prisma.muscle.create).toHaveBeenCalled();
    });

    test('updateMuscle uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.muscle.update.mockResolvedValue({});
      await ExerciseResolvers.Mutation.updateMuscle(null as any, { id: 1, input: {} }, ctx);
      expect(ctx.prisma.muscle.update).toHaveBeenCalled();
    });

    test('deleteMuscle uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.muscle.delete.mockResolvedValue({});
      const res = await ExerciseResolvers.Mutation.deleteMuscle(null as any, { id: 1 }, ctx);
      expect(ctx.prisma.muscle.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toBe(true);
    });

    test('createMetric uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.metric.create.mockResolvedValue({});
      await ExerciseResolvers.Mutation.createMetric(null as any, { input: {} }, ctx);
      expect(ctx.prisma.metric.create).toHaveBeenCalled();
    });

    test('updateMetric uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.metric.update.mockResolvedValue({});
      await ExerciseResolvers.Mutation.updateMetric(null as any, { id: 1, input: {} }, ctx);
      expect(ctx.prisma.metric.update).toHaveBeenCalled();
    });

    test('deleteMetric uses prisma', async () => {
      const ctx = createContext();
      ctx.prisma.metric.delete.mockResolvedValue({});
      const res = await ExerciseResolvers.Mutation.deleteMetric(null as any, { id: 1 }, ctx);
      expect(ctx.prisma.metric.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toBe(true);
    });
  });
});
