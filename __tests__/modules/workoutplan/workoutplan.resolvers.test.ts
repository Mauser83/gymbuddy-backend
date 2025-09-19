import { WorkoutPlanResolvers } from '../../../src/modules/workoutplan/workoutplan.resolvers';
import { WorkoutPlanService } from '../../../src/modules/workoutplan/workoutplan.service';

jest.mock('../../../src/modules/workoutplan/workoutplan.service');

const mockedService = jest.mocked(WorkoutPlanService);

function createContext() {
  return {
    prisma: {
      workoutPlanExercise: { findMany: jest.fn() },
      trainingGoal: { findUnique: jest.fn() },
      intensityPreset: { findUnique: jest.fn() },
      muscleGroup: { findMany: jest.fn() },
      assignedWorkout: { findMany: jest.fn() },
      workoutSession: { findMany: jest.fn() },
      trainingMethod: { findUnique: jest.fn(), findMany: jest.fn() },
    } as any,
    userId: 1,
    permissionService: {
      checkPermission: jest.fn(),
      getUserRoles: jest.fn(),
      verifyAppRoles: jest.fn(),
    } as any,
  } as any;
}

describe('WorkoutPlanResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
  });

  describe('field resolvers', () => {
    test('WorkoutPlan.exercises queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.workoutPlanExercise.findMany.mockResolvedValue([]);
      await WorkoutPlanResolvers.WorkoutPlan.exercises({ id: 1 }, {}, ctx);
      expect(ctx.prisma.workoutPlanExercise.findMany).toHaveBeenCalledWith({
        where: { workoutPlanId: 1 },
        include: { exercise: true, trainingMethod: true },
      });
    });

    test('WorkoutPlanExercise.groupId returns value or null', () => {
      const resultWithId = WorkoutPlanResolvers.WorkoutPlanExercise.groupId({
        groupId: 'abc123',
      });
      const resultWithoutId = WorkoutPlanResolvers.WorkoutPlanExercise.groupId({});
      expect(resultWithId).toBe('abc123');
      expect(resultWithoutId).toBeNull();
    });

    test('WorkoutPlan.intensityPreset returns null when no id', async () => {
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.WorkoutPlan.intensityPreset(
        { intensityPresetId: null },
        {},
        ctx,
      );
      expect(res).toBeNull();
      expect(ctx.prisma.intensityPreset.findUnique).not.toHaveBeenCalled();
    });

    test('WorkoutPlanExercise.trainingMethod fetches when id', async () => {
      const ctx = createContext();
      ctx.prisma.trainingMethod.findUnique.mockResolvedValue({ id: 2 });
      const res = await WorkoutPlanResolvers.WorkoutPlanExercise.trainingMethod(
        { trainingMethodId: 2 },
        {},
        ctx,
      );
      expect(ctx.prisma.trainingMethod.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
      });
      expect(res).toEqual({ id: 2 });
    });
  });

  describe('Query resolvers', () => {
    test('workoutPlans uses service', async () => {
      const instance = { getWorkoutPlans: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await WorkoutPlanResolvers.Query.workoutPlans(null as any, {}, ctx);
      expect(instance.getWorkoutPlans).toHaveBeenCalledWith(ctx.userId);
    });

    test('workoutPlans requires auth', async () => {
      const ctx = createContext();
      ctx.userId = null as any;
      await expect(WorkoutPlanResolvers.Query.workoutPlans(null as any, {}, ctx)).rejects.toThrow(
        'Unauthenticated',
      );
    });
  });

  describe('Mutation resolvers', () => {
    test('createWorkoutPlan uses service', async () => {
      const instance = { createWorkoutPlan: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await WorkoutPlanResolvers.Mutation.createWorkoutPlan(null as any, { input: {} }, ctx);
      expect(instance.createWorkoutPlan).toHaveBeenCalled();
    });

    test('deleteWorkoutPlan requires auth', async () => {
      const ctx = createContext();
      ctx.userId = null as any;
      await expect(
        WorkoutPlanResolvers.Mutation.deleteWorkoutPlan(null as any, { id: 1 }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });
  });
});
