import { WorkoutPlanResolvers } from '../../../src/modules/workoutplan/workoutplan.resolvers';
import { WorkoutPlanService } from '../../../src/modules/workoutplan/workoutplan.service';

jest.mock('../../../src/modules/workoutplan/workoutplan.service');

const mockedService = jest.mocked(WorkoutPlanService);

function createContext(overrides: Record<string, any> = {}) {
  const prisma = {
    workoutPlanExercise: { findMany: jest.fn() },
    trainingGoal: { findUnique: jest.fn(), findMany: jest.fn() },
    intensityPreset: { findUnique: jest.fn(), findMany: jest.fn() },
    muscleGroup: { findMany: jest.fn() },
    assignedWorkout: { findMany: jest.fn() },
    workoutSession: { findMany: jest.fn() },
    trainingMethod: { findUnique: jest.fn(), findMany: jest.fn() },
    workoutPlanGroup: { findMany: jest.fn() },
    intensityMetricDefault: { findMany: jest.fn() },
    experienceLevel: { findUnique: jest.fn(), findMany: jest.fn() },
  } as any;

  const context = {
    prisma,
    userId: 1,
    permissionService: {
      checkPermission: jest.fn(),
      getUserRoles: jest.fn(),
      verifyAppRoles: jest.fn(),
      verifyPremiumAccess: jest.fn(),
    },
  } as any;

  if (overrides.prisma) {
    Object.assign(prisma, overrides.prisma);
  }

  return { ...context, ...overrides };
}

function mockService(methods: Record<string, jest.Mock> = {}) {
  const instance = { ...methods } as any;
  mockedService.mockImplementation(() => instance);
  return instance;
}

describe('WorkoutPlanResolvers', () => {
  beforeEach(() => {
    mockedService.mockReset();
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

    test('WorkoutPlan.trainingGoal fetches relation', async () => {
      const ctx = createContext();
      ctx.prisma.trainingGoal.findUnique.mockResolvedValue({ id: 9 });
      const result = await WorkoutPlanResolvers.WorkoutPlan.trainingGoal(
        { trainingGoalId: 9 },
        {},
        ctx,
      );
      expect(ctx.prisma.trainingGoal.findUnique).toHaveBeenCalledWith({
        where: { id: 9 },
      });
      expect(result).toEqual({ id: 9 });
    });

    test('WorkoutPlanExercise.groupId returns value or null', () => {
      const resultWithId = WorkoutPlanResolvers.WorkoutPlanExercise.groupId({
        groupId: 'abc123',
      });
      const resultWithoutId = WorkoutPlanResolvers.WorkoutPlanExercise.groupId({});
      expect(resultWithId).toBe('abc123');
      expect(resultWithoutId).toBeNull();
    });

    test('WorkoutPlanExercise.trainingMethod returns null when missing id', async () => {
      const ctx = createContext();
      const result = await WorkoutPlanResolvers.WorkoutPlanExercise.trainingMethod(
        { trainingMethodId: null },
        {},
        ctx,
      );
      expect(result).toBeNull();
      expect(ctx.prisma.trainingMethod.findUnique).not.toHaveBeenCalled();
    });

    test('WorkoutPlanExercise.targetMetrics defaults to empty array', () => {
      expect(WorkoutPlanResolvers.WorkoutPlanExercise.targetMetrics({})).toEqual([]);
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

    test('WorkoutPlan.muscleGroups queries relation', async () => {
      const ctx = createContext();
      ctx.prisma.muscleGroup.findMany.mockResolvedValue([{ id: 3 }]);
      const res = await WorkoutPlanResolvers.WorkoutPlan.muscleGroups({ id: 7 }, {}, ctx);
      expect(ctx.prisma.muscleGroup.findMany).toHaveBeenCalledWith({
        where: { plans: { some: { id: 7 } } },
      });
      expect(res).toEqual([{ id: 3 }]);
    });

    test('WorkoutPlan.assignedWorkouts lists assignments', async () => {
      const ctx = createContext();
      ctx.prisma.assignedWorkout.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await WorkoutPlanResolvers.WorkoutPlan.assignedWorkouts({ id: 5 }, {}, ctx);
      expect(ctx.prisma.assignedWorkout.findMany).toHaveBeenCalledWith({
        where: { workoutPlanId: 5 },
      });
      expect(res).toEqual([{ id: 1 }]);
    });

    test('WorkoutPlan.sessions fetches related sessions', async () => {
      const ctx = createContext();
      ctx.prisma.workoutSession.findMany.mockResolvedValue([{ id: 2 }]);
      const res = await WorkoutPlanResolvers.WorkoutPlan.sessions({ id: 8 }, {}, ctx);
      expect(ctx.prisma.workoutSession.findMany).toHaveBeenCalledWith({
        where: { workoutPlanId: 8 },
      });
      expect(res).toEqual([{ id: 2 }]);
    });

    test('WorkoutPlan.groups fetches groups with relations', async () => {
      const ctx = createContext();
      ctx.prisma.workoutPlanGroup.findMany.mockResolvedValue([{ id: 10 }]);
      const res = await WorkoutPlanResolvers.WorkoutPlan.groups({ id: 4 }, {}, ctx);
      expect(ctx.prisma.workoutPlanGroup.findMany).toHaveBeenCalledWith({
        where: { workoutPlanId: 4 },
        include: { trainingMethod: true, exercises: true },
      });
      expect(res).toEqual([{ id: 10 }]);
    });

    test('IntensityPreset resolvers look up related data', async () => {
      const ctx = createContext();
      ctx.prisma.trainingGoal.findUnique.mockResolvedValue({ id: 2 });
      ctx.prisma.experienceLevel.findUnique.mockResolvedValue({ id: 3 });
      ctx.prisma.intensityMetricDefault.findMany.mockResolvedValue([{ id: 4 }]);

      const parent = { id: 1, trainingGoalId: 2, experienceLevelId: 3 };
      const [goal, level, metrics] = await Promise.all([
        WorkoutPlanResolvers.IntensityPreset.trainingGoal(parent, {}, ctx),
        WorkoutPlanResolvers.IntensityPreset.experienceLevel(parent, {}, ctx),
        WorkoutPlanResolvers.IntensityPreset.metricDefaults(parent, {}, ctx),
      ]);

      expect(ctx.prisma.trainingGoal.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(ctx.prisma.experienceLevel.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(ctx.prisma.intensityMetricDefault.findMany).toHaveBeenCalledWith({
        where: { presetId: 1 },
      });
      expect(goal).toEqual({ id: 2 });
      expect(level).toEqual({ id: 3 });
      expect(metrics).toEqual([{ id: 4 }]);
    });

    test('TrainingGoal.trainingMethods filters by goal', async () => {
      const ctx = createContext();
      ctx.prisma.trainingMethod.findMany.mockResolvedValue([{ id: 5 }]);
      const res = await WorkoutPlanResolvers.TrainingGoal.trainingMethods({ id: 11 }, {}, ctx);
      expect(ctx.prisma.trainingMethod.findMany).toHaveBeenCalledWith({
        where: { trainingGoals: { some: { id: 11 } } },
      });
      expect(res).toEqual([{ id: 5 }]);
    });

    test('TrainingMethod resolvers expose helpers', async () => {
      const ctx = createContext();
      ctx.prisma.trainingGoal.findMany.mockResolvedValue([{ id: 6 }]);
      const parent = { id: 12, minGroupSize: 1, maxGroupSize: undefined, shouldAlternate: false };
      const [goals, minGroupSize, maxGroupSize, shouldAlternate] = await Promise.all([
        WorkoutPlanResolvers.TrainingMethod.trainingGoals(parent, {}, ctx),
        Promise.resolve(WorkoutPlanResolvers.TrainingMethod.minGroupSize(parent)),
        Promise.resolve(WorkoutPlanResolvers.TrainingMethod.maxGroupSize(parent)),
        Promise.resolve(WorkoutPlanResolvers.TrainingMethod.shouldAlternate(parent)),
      ]);

      expect(ctx.prisma.trainingGoal.findMany).toHaveBeenCalledWith({
        where: { trainingMethods: { some: { id: 12 } } },
      });
      expect(goals).toEqual([{ id: 6 }]);
      expect(minGroupSize).toBe(1);
      expect(maxGroupSize).toBeNull();
      expect(shouldAlternate).toBe(false);
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

    test('workoutPlanById delegates to service', async () => {
      const instance = mockService({ getWorkoutPlanById: jest.fn().mockResolvedValue({ id: 1 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Query.workoutPlanById(
        null as any,
        { id: 42 },
        ctx,
      );
      expect(instance.getWorkoutPlanById).toHaveBeenCalledWith(ctx.userId, 42);
      expect(res).toEqual({ id: 1 });
    });

    test('sharedWorkoutPlans delegates to service', async () => {
      const instance = mockService({ getSharedWorkoutPlans: jest.fn().mockResolvedValue(['shared']) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Query.sharedWorkoutPlans(null as any, {}, ctx);
      expect(instance.getSharedWorkoutPlans).toHaveBeenCalledWith(ctx.userId);
      expect(res).toEqual(['shared']);
    });

    test('getTrainingGoals returns nested relations', async () => {
      const ctx = createContext();
      ctx.prisma.trainingGoal.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await WorkoutPlanResolvers.Query.getTrainingGoals(null as any, {}, ctx);
      expect(ctx.prisma.trainingGoal.findMany).toHaveBeenCalledWith({
        include: { presets: { include: { metricDefaults: true } }, trainingMethods: true },
      });
      expect(res).toEqual([{ id: 1 }]);
    });

    test('getIntensityPresets supports optional filter', async () => {
      const ctx = createContext();
      ctx.prisma.intensityPreset.findMany.mockResolvedValue([{ id: 9 }]);
      const res = await WorkoutPlanResolvers.Query.getIntensityPresets(
        null as any,
        { trainingGoalId: 77 },
        ctx,
      );
      expect(ctx.prisma.intensityPreset.findMany).toHaveBeenCalledWith({
        where: { trainingGoalId: 77 },
        include: { metricDefaults: true },
      });
      expect(res).toEqual([{ id: 9 }]);
    });

    test('experienceLevels delegates to WorkoutPlanService', async () => {
      const instance = mockService({ getExperienceLevels: jest.fn().mockResolvedValue(['level']) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Query.experienceLevels(null as any, {}, ctx);
      expect(instance.getExperienceLevels).toHaveBeenCalledWith();
      expect(res).toEqual(['level']);
    });

    test('getWorkoutPrograms throws when unauthenticated', async () => {
      const ctx = createContext();
      ctx.userId = null;
      await expect(
        WorkoutPlanResolvers.Query.getWorkoutPrograms(null as any, {}, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('getWorkoutPrograms delegates to service', async () => {
      const instance = mockService({ getWorkoutPrograms: jest.fn().mockResolvedValue(['program']) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Query.getWorkoutPrograms(null as any, {}, ctx);
      expect(instance.getWorkoutPrograms).toHaveBeenCalledWith(ctx.userId);
      expect(res).toEqual(['program']);
    });

    test('experienceLevel fetches a single level', async () => {
      const ctx = createContext();
      ctx.prisma.experienceLevel.findUnique.mockResolvedValue({ id: 55 });

      const res = await WorkoutPlanResolvers.Query.experienceLevel(
        null as any,
        { id: 55 },
        ctx,
      );

      expect(ctx.prisma.experienceLevel.findUnique).toHaveBeenCalledWith({ where: { id: 55 } });
      expect(res).toEqual({ id: 55 });
    });

    test('getMuscleGroups includes body parts', async () => {
      const ctx = createContext();
      ctx.prisma.muscleGroup.findMany.mockResolvedValue([{ id: 99 }]);

      const res = await WorkoutPlanResolvers.Query.getMuscleGroups(null as any, {}, ctx);

      expect(ctx.prisma.muscleGroup.findMany).toHaveBeenCalledWith({ include: { bodyParts: true } });
      expect(res).toEqual([{ id: 99 }]);
    });

    test('getTrainingMethods returns all methods', async () => {
      const ctx = createContext();
      ctx.prisma.trainingMethod.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const res = await WorkoutPlanResolvers.Query.getTrainingMethods(null as any, {}, ctx);

      expect(ctx.prisma.trainingMethod.findMany).toHaveBeenCalledWith();
      expect(res).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('getTrainingMethodsByGoal applies goal filter', async () => {
      const ctx = createContext();
      ctx.prisma.trainingMethod.findMany.mockResolvedValue([{ id: 7 }]);

      const res = await WorkoutPlanResolvers.Query.getTrainingMethodsByGoal(
        null as any,
        { goalId: 7 },
        ctx,
      );

      expect(ctx.prisma.trainingMethod.findMany).toHaveBeenCalledWith({
        where: { trainingGoals: { some: { id: 7 } } },
      });
      expect(res).toEqual([{ id: 7 }]);
    });

    test('getWorkoutProgramById delegates to service', async () => {
      const instance = mockService({
        getWorkoutProgramById: jest.fn().mockResolvedValue({ id: 22 }),
      });
      const ctx = createContext();

      const res = await WorkoutPlanResolvers.Query.getWorkoutProgramById(
        null as any,
        { id: 22 },
        ctx,
      );

      expect(instance.getWorkoutProgramById).toHaveBeenCalledWith(ctx.userId, 22);
      expect(res).toEqual({ id: 22 });
    });

    test('getUserWorkoutPreferences delegates to service', async () => {
      const instance = mockService({
        getUserWorkoutPreferences: jest.fn().mockResolvedValue({ intensity: 'medium' }),
      });
      const ctx = createContext();

      const res = await WorkoutPlanResolvers.Query.getUserWorkoutPreferences(null as any, {}, ctx);

      expect(instance.getUserWorkoutPreferences).toHaveBeenCalledWith(ctx.userId);
      expect(res).toEqual({ intensity: 'medium' });
    });
  });

  describe('Mutation resolvers', () => {
    test('createWorkoutPlan uses service', async () => {
      const instance = mockService({ createWorkoutPlan: jest.fn() });
      const ctx = createContext();
      const input = { name: 'Plan' };
      await WorkoutPlanResolvers.Mutation.createWorkoutPlan(null as any, { input }, ctx);
      expect(instance.createWorkoutPlan).toHaveBeenCalledWith(ctx.userId, input);
    });

    test('deleteWorkoutPlan requires auth', async () => {
      const ctx = createContext();
      ctx.userId = null as any;
      await expect(
        WorkoutPlanResolvers.Mutation.deleteWorkoutPlan(null as any, { id: 1 }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('updateWorkoutPlan delegates to service', async () => {
      const instance = mockService({ updateWorkoutPlan: jest.fn().mockResolvedValue({ id: 1 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateWorkoutPlan(
        null as any,
        { id: 6, input: { name: 'Updated' } as any },
        ctx,
      );
      expect(instance.updateWorkoutPlan).toHaveBeenCalledWith(ctx.userId, 6, { name: 'Updated' });
      expect(res).toEqual({ id: 1 });
    });

    test('deleteWorkoutPlan delegates to service when authenticated', async () => {
      const instance = mockService({ deleteWorkoutPlan: jest.fn().mockResolvedValue(true as any) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteWorkoutPlan(
        null as any,
        { id: 7 },
        ctx,
      );
      expect(instance.deleteWorkoutPlan).toHaveBeenCalledWith(ctx.userId, 7);
      expect(res).toBe(true);
    });

    test('shareWorkoutPlan coerces missing shareWithUserId to null', async () => {
      const instance = mockService({
        shareWorkoutPlan: jest.fn().mockResolvedValue({ id: 1 }),
      });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.shareWorkoutPlan(
        null as any,
        { workoutId: 3 },
        ctx,
      );
      expect(instance.shareWorkoutPlan).toHaveBeenCalledWith(ctx.userId, 3, null);
      expect(res).toEqual({ id: 1 });
    });

    test('createWorkoutPlanVersion delegates to service', async () => {
      const instance = mockService({
        createWorkoutPlanVersion: jest.fn().mockResolvedValue({ id: 4 }),
      });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createWorkoutPlanVersion(
        null as any,
        { parentPlanId: 2, input: { name: 'v2' } },
        ctx,
      );
      expect(instance.createWorkoutPlanVersion).toHaveBeenCalledWith(ctx.userId, 2, { name: 'v2' });
      expect(res).toEqual({ id: 4 });
    });

    test('createTrainingGoal delegates to service', async () => {
      const instance = mockService({ createTrainingGoal: jest.fn().mockResolvedValue({ id: 8 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createTrainingGoal(
        null as any,
        { input: { name: 'Goal' } },
        ctx,
      );
      expect(instance.createTrainingGoal).toHaveBeenCalledWith(ctx, { name: 'Goal' });
      expect(res).toEqual({ id: 8 });
    });

    test('updateTrainingGoal delegates to service', async () => {
      const instance = mockService({ updateTrainingGoal: jest.fn().mockResolvedValue({ id: 9 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateTrainingGoal(
        null as any,
        { id: 5, input: { name: 'Updated' } },
        ctx,
      );
      expect(instance.updateTrainingGoal).toHaveBeenCalledWith(ctx, 5, { name: 'Updated' });
      expect(res).toEqual({ id: 9 });
    });

    test('deleteTrainingGoal delegates to service', async () => {
      const instance = mockService({ deleteTrainingGoal: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteTrainingGoal(null as any, { id: 4 }, ctx);
      expect(instance.deleteTrainingGoal).toHaveBeenCalledWith(ctx, 4);
      expect(res).toBe(true);
    });

    test('createIntensityPreset delegates to service', async () => {
      const instance = mockService({
        createIntensityPreset: jest.fn().mockResolvedValue({ id: 10 }),
      });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createIntensityPreset(
        null as any,
        { input: { name: 'Preset' } },
        ctx,
      );
      expect(instance.createIntensityPreset).toHaveBeenCalledWith(ctx, { name: 'Preset' });
      expect(res).toEqual({ id: 10 });
    });

    test('updateIntensityPreset delegates to service', async () => {
      const instance = mockService({
        updateIntensityPreset: jest.fn().mockResolvedValue({ id: 11 }),
      });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateIntensityPreset(
        null as any,
        { id: 6, input: { name: 'Preset' } },
        ctx,
      );
      expect(instance.updateIntensityPreset).toHaveBeenCalledWith(ctx, 6, { name: 'Preset' });
      expect(res).toEqual({ id: 11 });
    });

    test('deleteIntensityPreset delegates to service', async () => {
      const instance = mockService({ deleteIntensityPreset: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteIntensityPreset(null as any, { id: 12 }, ctx);
      expect(instance.deleteIntensityPreset).toHaveBeenCalledWith(ctx, 12);
      expect(res).toBe(true);
    });

    test('createExperienceLevel delegates to service', async () => {
      const instance = mockService({ createExperienceLevel: jest.fn().mockResolvedValue({ id: 13 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createExperienceLevel(
        null as any,
        { input: { name: 'Beginner' } },
        ctx,
      );
      expect(instance.createExperienceLevel).toHaveBeenCalledWith(ctx, { name: 'Beginner' });
      expect(res).toEqual({ id: 13 });
    });

    test('updateExperienceLevel delegates to service', async () => {
      const instance = mockService({ updateExperienceLevel: jest.fn().mockResolvedValue({ id: 14 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateExperienceLevel(
        null as any,
        { id: 4, input: { name: 'Advanced' } },
        ctx,
      );
      expect(instance.updateExperienceLevel).toHaveBeenCalledWith(ctx, 4, { name: 'Advanced' });
      expect(res).toEqual({ id: 14 });
    });

    test('deleteExperienceLevel delegates to service', async () => {
      const instance = mockService({ deleteExperienceLevel: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteExperienceLevel(null as any, { id: 6 }, ctx);
      expect(instance.deleteExperienceLevel).toHaveBeenCalledWith(ctx, 6);
      expect(res).toBe(true);
    });

    test('createMuscleGroup delegates to service', async () => {
      const instance = mockService({ createMuscleGroup: jest.fn().mockResolvedValue({ id: 77 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createMuscleGroup(
        null as any,
        { input: { name: 'Chest' } },
        ctx,
      );
      expect(instance.createMuscleGroup).toHaveBeenCalledWith(ctx, { name: 'Chest' });
      expect(res).toEqual({ id: 77 });
    });

    test('updateMuscleGroup delegates to service', async () => {
      const instance = mockService({ updateMuscleGroup: jest.fn().mockResolvedValue({ id: 78 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateMuscleGroup(
        null as any,
        { id: 2, input: { name: 'Back' } },
        ctx,
      );
      expect(instance.updateMuscleGroup).toHaveBeenCalledWith(ctx, 2, { name: 'Back' });
      expect(res).toEqual({ id: 78 });
    });

    test('deleteMuscleGroup delegates to service', async () => {
      const instance = mockService({ deleteMuscleGroup: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteMuscleGroup(null as any, { id: 9 }, ctx);
      expect(instance.deleteMuscleGroup).toHaveBeenCalledWith(ctx, 9);
      expect(res).toBe(true);
    });

    test('createTrainingMethod delegates to service', async () => {
      const instance = mockService({ createTrainingMethod: jest.fn().mockResolvedValue({ id: 21 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createTrainingMethod(
        null as any,
        { input: { name: 'HIIT' } },
        ctx,
      );
      expect(instance.createTrainingMethod).toHaveBeenCalledWith(ctx, { name: 'HIIT' });
      expect(res).toEqual({ id: 21 });
    });

    test('updateTrainingMethod delegates to service', async () => {
      const instance = mockService({ updateTrainingMethod: jest.fn().mockResolvedValue({ id: 22 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateTrainingMethod(
        null as any,
        { id: 3, input: { name: 'Circuit' } },
        ctx,
      );
      expect(instance.updateTrainingMethod).toHaveBeenCalledWith(ctx, 3, { name: 'Circuit' });
      expect(res).toEqual({ id: 22 });
    });

    test('deleteTrainingMethod delegates to service', async () => {
      const instance = mockService({ deleteTrainingMethod: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteTrainingMethod(null as any, { id: 5 }, ctx);
      expect(instance.deleteTrainingMethod).toHaveBeenCalledWith(ctx, 5);
      expect(res).toBe(true);
    });

    test('createWorkoutProgram delegates to service', async () => {
      const instance = mockService({ createWorkoutProgram: jest.fn().mockResolvedValue({ id: 31 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createWorkoutProgram(
        null as any,
        { input: { name: 'Program' } },
        ctx,
      );
      expect(instance.createWorkoutProgram).toHaveBeenCalledWith(ctx.userId, { name: 'Program' });
      expect(res).toEqual({ id: 31 });
    });

    test('updateWorkoutProgram delegates to service', async () => {
      const instance = mockService({ updateWorkoutProgram: jest.fn().mockResolvedValue({ id: 32 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateWorkoutProgram(
        null as any,
        { id: 8, input: { name: 'Updated Program' } },
        ctx,
      );
      expect(instance.updateWorkoutProgram).toHaveBeenCalledWith(ctx.userId, 8, { name: 'Updated Program' });
      expect(res).toEqual({ id: 32 });
    });

    test('deleteWorkoutProgram delegates to service', async () => {
      const instance = mockService({ deleteWorkoutProgram: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteWorkoutProgram(null as any, { id: 11 }, ctx);
      expect(instance.deleteWorkoutProgram).toHaveBeenCalledWith(ctx.userId, 11);
      expect(res).toBe(true);
    });

    test('createWorkoutProgramDay delegates to service', async () => {
      const instance = mockService({ createWorkoutProgramDay: jest.fn().mockResolvedValue({ id: 41 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createWorkoutProgramDay(
        null as any,
        { input: { name: 'Day 1' } },
        ctx,
      );
      expect(instance.createWorkoutProgramDay).toHaveBeenCalledWith(ctx.userId, { name: 'Day 1' });
      expect(res).toEqual({ id: 41 });
    });

    test('updateWorkoutProgramDay delegates to service', async () => {
      const instance = mockService({ updateWorkoutProgramDay: jest.fn().mockResolvedValue({ id: 42 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.updateWorkoutProgramDay(
        null as any,
        { id: 9, input: { name: 'Day 2' } },
        ctx,
      );
      expect(instance.updateWorkoutProgramDay).toHaveBeenCalledWith(ctx.userId, 9, { name: 'Day 2' });
      expect(res).toEqual({ id: 42 });
    });

    test('deleteWorkoutProgramDay delegates to service', async () => {
      const instance = mockService({ deleteWorkoutProgramDay: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteWorkoutProgramDay(null as any, { id: 12 }, ctx);
      expect(instance.deleteWorkoutProgramDay).toHaveBeenCalledWith(ctx.userId, 12);
      expect(res).toBe(true);
    });

    test('createWorkoutProgramCooldown delegates to service', async () => {
      const instance = mockService({ createWorkoutProgramCooldown: jest.fn().mockResolvedValue({ id: 51 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createWorkoutProgramCooldown(
        null as any,
        { input: { name: 'Cooldown' } },
        ctx,
      );
      expect(instance.createWorkoutProgramCooldown).toHaveBeenCalledWith(ctx.userId, { name: 'Cooldown' });
      expect(res).toEqual({ id: 51 });
    });

    test('deleteWorkoutProgramCooldown delegates to service', async () => {
      const instance = mockService({ deleteWorkoutProgramCooldown: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteWorkoutProgramCooldown(null as any, { id: 13 }, ctx);
      expect(instance.deleteWorkoutProgramCooldown).toHaveBeenCalledWith(ctx.userId, 13);
      expect(res).toBe(true);
    });

    test('createWorkoutProgramAssignment delegates to service', async () => {
      const instance = mockService({ createWorkoutProgramAssignment: jest.fn().mockResolvedValue({ id: 61 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.createWorkoutProgramAssignment(
        null as any,
        { input: { userId: 2 } },
        ctx,
      );
      expect(instance.createWorkoutProgramAssignment).toHaveBeenCalledWith(ctx.userId, { userId: 2 });
      expect(res).toEqual({ id: 61 });
    });

    test('deleteWorkoutProgramAssignment delegates to service', async () => {
      const instance = mockService({ deleteWorkoutProgramAssignment: jest.fn().mockResolvedValue(true) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.deleteWorkoutProgramAssignment(null as any, { id: 14 }, ctx);
      expect(instance.deleteWorkoutProgramAssignment).toHaveBeenCalledWith(ctx.userId, 14);
      expect(res).toBe(true);
    });

    test('setUserWorkoutPreferences delegates to service', async () => {
      const instance = mockService({ setUserWorkoutPreferences: jest.fn().mockResolvedValue({ success: true }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.setUserWorkoutPreferences(
        null as any,
        { input: { intensity: 'high' } },
        ctx,
      );
      expect(instance.setUserWorkoutPreferences).toHaveBeenCalledWith(ctx.userId, { intensity: 'high' });
      expect(res).toEqual({ success: true });
    });

    test('shareWorkoutProgram normalizes optional user id', async () => {
      const instance = mockService({ shareWorkoutProgram: jest.fn().mockResolvedValue({ id: 71 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.shareWorkoutProgram(
        null as any,
        { programId: 5 },
        ctx,
      );
      expect(instance.shareWorkoutProgram).toHaveBeenCalledWith(ctx.userId, 5, null);
      expect(res).toEqual({ id: 71 });
    });

    test('shareWorkoutProgram forwards shareWithUserId when provided', async () => {
      const instance = mockService({ shareWorkoutProgram: jest.fn().mockResolvedValue({ id: 72 }) });
      const ctx = createContext();
      const res = await WorkoutPlanResolvers.Mutation.shareWorkoutProgram(
        null as any,
        { programId: 6, shareWithUserId: 42 },
        ctx,
      );
      expect(instance.shareWorkoutProgram).toHaveBeenCalledWith(ctx.userId, 6, 42);
      expect(res).toEqual({ id: 72 });
    });

    test('updateTrainingMethodGoals delegates to service', async () => {
      const instance = mockService({
        updateTrainingMethodGoals: jest.fn().mockResolvedValue({ updated: true }),
      });
      const ctx = createContext();
      const input = { methodId: 1 } as any;
      const res = await WorkoutPlanResolvers.Mutation.updateTrainingMethodGoals(null as any, { input }, ctx);
      expect(instance.updateTrainingMethodGoals).toHaveBeenCalledWith(ctx, input);
      expect(res).toEqual({ updated: true });
    });
  });
});