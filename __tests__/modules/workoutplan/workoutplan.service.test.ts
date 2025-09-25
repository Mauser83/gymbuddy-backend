import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { validateInput } from '../../../src/middlewares/validation';
import { verifyRoles } from '../../../src/modules/auth/auth.roles';
import {
  CreateWorkoutPlanDto,
  CreateTrainingMethodDto,
  UpdateTrainingMethodDto,
  CreateWorkoutProgramDto,
  UpdateWorkoutProgramDto,
  CreateWorkoutProgramDayDto,
  UpdateWorkoutProgramDayDto,
  CreateWorkoutProgramCooldownDto,
  CreateWorkoutProgramAssignmentDto,
  SetUserWorkoutPreferencesDto,
  CreateExperienceLevelDto,
  UpdateExperienceLevelDto,
  UpdateTrainingMethodGoalsDto,
} from '../../../src/modules/workoutplan/workoutplan.dto';
import { WorkoutPlanService } from '../../../src/modules/workoutplan/workoutplan.service';
import { PrismaClient } from '../../../src/prisma';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles', () => ({
  verifyRoles: jest.fn(),
}));

const mockedValidate = jest.mocked(validateInput as any);
const mockedVerifyRoles = jest.mocked(verifyRoles);

describe('WorkoutPlanService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let permission: {
    getUserRoles: jest.Mock;
    verifyAppRoles: jest.Mock;
    verifyPremiumAccess: jest.Mock;
  };
  let sharing: { shareWorkoutPlan: jest.Mock; shareWorkoutProgram: jest.Mock };
  let service: WorkoutPlanService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
    permission = {
      getUserRoles: jest.fn(),
      verifyAppRoles: jest.fn(),
      verifyPremiumAccess: jest.fn(),
    } as any;
    sharing = {
      shareWorkoutPlan: jest.fn(),
      shareWorkoutProgram: jest.fn(),
    } as any;
    service = new WorkoutPlanService(prisma, permission as any, sharing as any);
    mockedValidate.mockResolvedValue(undefined as any);
  });

  afterEach(() => jest.clearAllMocks());

  test('verifyWorkoutPlanAccess throws when not found', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue(null as any);
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    await expect((service as any).verifyWorkoutPlanAccess(1, 2)).rejects.toThrow(
      'Workout not found',
    );
  });

  test('verifyWorkoutPlanAccess throws when unauthorized', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 5,
      sharedWith: [],
    } as any);
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(false);
    await expect((service as any).verifyWorkoutPlanAccess(1, 2)).rejects.toThrow(
      'Unauthorized workout access',
    );
  });

  test('createWorkoutPlan checks premium and creates exercises', async () => {
    permission.getUserRoles.mockResolvedValue({ userRoles: ['USER'] } as any);
    permission.verifyPremiumAccess.mockReturnValue(true);
    prisma.workoutPlan.create.mockResolvedValue({ id: 1 } as any);

    const input = {
      name: 'Plan A',
      exercises: [
        {
          exerciseId: 2,
          targetSets: 3,
          targetMetrics: [{ metricId: 1, min: 10, max: 15 }],
          groupId: 'group-xyz',
          trainingMethodId: 4,
          isWarmup: false,
        },
      ],
    };

    await service.createWorkoutPlan(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutPlanDto);
    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          exerciseId: 2,
          groupId: null,
          trainingMethodId: 4,
          isWarmup: false,
          targetSets: 3,
          targetMetrics: expect.anything(),
        }),
      ]),
    });
  });

  test('createWorkoutPlan denies non premium users', async () => {
    permission.getUserRoles.mockResolvedValue({ userRoles: ['USER'] } as any);
    permission.verifyPremiumAccess.mockReturnValue(false);

    await expect(service.createWorkoutPlan(1, { name: 'n' } as any)).rejects.toThrow(
      'Premium subscription required to create workouts',
    );
  });

  test('createWorkoutPlan rejects unauthenticated requests', async () => {
    await expect(service.createWorkoutPlan(0 as any, { name: 'test' } as any)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('createPlanExercises uses default group map when omitted', async () => {
    await (service as any).createPlanExercises(3, [
      { exerciseId: 9, targetSets: 2, targetMetrics: [], isWarmup: true },
    ]);

    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          workoutPlanId: 3,
          exerciseId: 9,
          order: 0,
          targetSets: 2,
          targetMetrics: [],
          trainingMethodId: null,
          groupId: null,
          isWarmup: true,
        }),
      ],
    });
  });

  test('createWorkoutPlan logs debug when outside test env and connects muscles', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    permission.getUserRoles.mockResolvedValue({ userRoles: ['USER'] } as any);
    permission.verifyPremiumAccess.mockReturnValue(true);
    prisma.experienceLevel.findFirst.mockResolvedValue({ id: 33 } as any);
    prisma.workoutPlan.create.mockResolvedValue({ id: 7 } as any);

    try {
      await service.createWorkoutPlan(9, {
        name: 'with muscles',
        description: 'desc',
        muscleGroupIds: [5],
      } as any);

      expect(consoleSpy).toHaveBeenCalledWith('createWorkoutPlan → userId:', 9);
      expect(prisma.workoutPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          experienceLevelId: 33,
          muscleGroups: { connect: [{ id: 5 }] },
        }),
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    }
  });

  test('createWorkoutPlanVersion ensures ownership', async () => {
    prisma.workoutPlan.findUnique.mockResolvedValueOnce({
      id: 1,
      userId: 1,
      sharedWith: [],
    } as any); // verifyWorkoutPlanAccess
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValueOnce({ userId: 1 } as any); // parent
    prisma.workoutPlan.count.mockResolvedValue(0 as any);
    prisma.workoutPlan.create.mockResolvedValue({ id: 2 } as any);

    const res = await service.createWorkoutPlanVersion(1, 1, {
      name: 'v1',
    } as any);
    expect(prisma.workoutPlan.create).toHaveBeenCalled();
    expect(res).toEqual({ id: 2 });
  });

  test('getWorkoutPlans filters by user', async () => {
    prisma.workoutPlan.findMany.mockResolvedValue([{ id: 1 }] as any);
    const res = await service.getWorkoutPlans(1);
    expect(prisma.workoutPlan.findMany).toHaveBeenCalledWith({
      where: { userId: 1, deletedAt: null },
    });
    expect(res).toEqual([{ id: 1 }]);
  });

  test('getWorkoutPlans throws when user missing', async () => {
    await expect(service.getWorkoutPlans(0 as any)).rejects.toThrow('Unauthorized');
  });

  test('getWorkoutPlanById returns plan when accessible', async () => {
    const timestamps = {
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
    } as any;
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(false);
    prisma.workoutPlan.findUnique
      .mockResolvedValueOnce({ userId: 1, sharedWith: [] } as any)
      .mockResolvedValueOnce({
        id: 4,
        name: 'Plan',
        description: 'desc',
        version: 1,
        isPublic: true,
        trainingGoalId: null,
        intensityPresetId: null,
        ...timestamps,
      } as any);

    const result = await service.getWorkoutPlanById(1, 4);

    expect(result).toEqual({
      id: 4,
      name: 'Plan',
      description: 'desc',
      version: 1,
      isPublic: true,
      trainingGoalId: null,
      intensityPresetId: null,
      ...timestamps,
    });
    expect(prisma.workoutPlan.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 4 },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublic: true,
        trainingGoalId: true,
        intensityPresetId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  test('getWorkoutPlanById throws when plan missing after access check', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique
      .mockResolvedValueOnce({ userId: 1, sharedWith: [] } as any)
      .mockResolvedValueOnce(null as any);

    await expect(service.getWorkoutPlanById(1, 10)).rejects.toThrow('Plan not found');
  });

  test('updateWorkoutPlan calls getWorkoutPlanById', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    const spy = jest.spyOn(service, 'getWorkoutPlanById').mockResolvedValue({ id: 1 } as any);
    await service.updateWorkoutPlan(1, 2, {
      name: 'n',
      muscleGroupIds: [],
      trainingGoalId: 1,
      exercises: [],
    } as any);
    expect(spy).toHaveBeenCalledWith(1, 2);
  });

  test('updateWorkoutPlan replaces exercises with groupId', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    prisma.workoutPlanExercise.deleteMany.mockResolvedValue({} as any);
    const spy = jest.spyOn(service, 'getWorkoutPlanById').mockResolvedValue({ id: 1 } as any);

    await service.updateWorkoutPlan(1, 1, {
      name: 'Updated',
      trainingGoalId: 1,
      muscleGroupIds: [],
      exercises: [
        {
          exerciseId: 2,
          targetSets: 3,
          targetMetrics: [{ metricId: 1, min: 5, max: 10 }],
          groupId: 'g123',
        },
      ],
    } as any);

    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ groupId: null })]),
    });
    expect(spy).toHaveBeenCalledWith(1, 1);
  });

  test('updateWorkoutPlan syncs experience level from preset', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [], userRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    prisma.intensityPreset.findUnique.mockResolvedValue({ experienceLevelId: 77 } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 10 } as any);
    const spy = jest.spyOn(service, 'getWorkoutPlanById').mockResolvedValue({ id: 10 } as any);

    await service.updateWorkoutPlan(1, 10, {
      name: 'Plan',
      description: 'd',
      isPublic: true,
      intensityPresetId: 3,
      muscleGroupIds: [],
    } as any);

    expect(prisma.intensityPreset.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { experienceLevelId: true },
    });
    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ experienceLevelId: 77 }),
    });
    expect(spy).toHaveBeenCalledWith(1, 10);
  });

  test('updateWorkoutPlan resets groups and muscle associations when provided', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({ userId: 1, sharedWith: [] } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 1 } as any);
    prisma.workoutPlanGroup.create.mockResolvedValue({ id: 77 } as any);
    const spy = jest.spyOn(service, 'getWorkoutPlanById').mockResolvedValue({ id: 1 } as any);

    await service.updateWorkoutPlan(1, 1, {
      name: 'Plan',
      description: 'desc',
      muscleGroupIds: [9],
      groups: [{ id: 44, trainingMethodId: 6 }],
    } as any);

    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        muscleGroups: { set: [{ id: 9 }] },
      }),
    });
    expect(prisma.workoutPlanGroup.deleteMany).toHaveBeenCalledWith({
      where: { workoutPlanId: 1 },
    });
    expect(prisma.workoutPlanGroup.create).toHaveBeenCalledWith({
      data: { workoutPlanId: 1, trainingMethodId: 6, order: 0 },
    });
    expect(spy).toHaveBeenCalledWith(1, 1);
  });

  test('shareWorkoutPlan delegates to sharing service', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({
      userId: 1,
      sharedWith: [],
    } as any);
    sharing.shareWorkoutPlan.mockResolvedValue({ id: 1 } as any);
    const res = await service.shareWorkoutPlan(1, 2, 3);
    expect(sharing.shareWorkoutPlan).toHaveBeenCalledWith(1, 2, 3, 'VIEW');
    expect(res).toEqual({ id: 1 });
  });

  test('shareWorkoutPlan marks plan public when user omitted', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique.mockResolvedValue({ userId: 1, sharedWith: [] } as any);
    prisma.workoutPlan.update.mockResolvedValue({ id: 4 } as any);

    const res = await service.shareWorkoutPlan(1, 4, null);

    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { isPublic: true },
    });
    expect(res).toEqual({ id: 4 });
  });

  test('shareWorkoutPlan requires authenticated owner', async () => {
    await expect(service.shareWorkoutPlan(0 as any, 1, null)).rejects.toThrow('Unauthorized');
  });

  test('deleteWorkoutPlan marks record as deleted', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [], userRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(false);
    prisma.workoutPlan.findUnique.mockResolvedValue({ userId: 1, sharedWith: [] } as any);

    const res = await service.deleteWorkoutPlan(1, 7);

    expect(prisma.workoutPlan.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(res).toBe('Workout plan marked as deleted');
  });

  test('deleteWorkoutPlan rejects unauthenticated users', async () => {
    await expect(service.deleteWorkoutPlan(0 as any, 1)).rejects.toThrow('Unauthorized');
  });

  test('getSharedWorkoutPlans returns visible plans', async () => {
    prisma.workoutPlan.findMany.mockResolvedValue([{ id: 9 }] as any);

    const res = await service.getSharedWorkoutPlans(4);

    expect(prisma.workoutPlan.findMany).toHaveBeenCalledWith({
      where: {
        sharedWith: { some: { id: 4 } },
        deletedAt: null,
      },
      select: { id: true, name: true, description: true },
    });
    expect(res).toEqual([{ id: 9 }]);
  });

  test('getSharedWorkoutPlans requires authentication', async () => {
    await expect(service.getSharedWorkoutPlans(0 as any)).rejects.toThrow('Unauthorized');
  });

  test('createTrainingMethod validates and creates', async () => {
    prisma.trainingMethod.create.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: 'ADMIN', userRole: 'USER', gymRoles: [] } as any;
    const res = await service.createTrainingMethod(ctx, {
      name: 'n',
      slug: 's',
    } as any);
    expect(mockedValidate).toHaveBeenCalledWith({ name: 'n', slug: 's' }, CreateTrainingMethodDto);
    expect(res).toEqual({ id: 1 });
  });

  test('updateTrainingMethod validates and updates', async () => {
    prisma.trainingMethod.update.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: 'ADMIN', userRole: 'USER', gymRoles: [] } as any;
    const res = await service.updateTrainingMethod(ctx, 1, {
      name: 'n',
    } as any);
    expect(mockedValidate).toHaveBeenCalledWith({ name: 'n' }, UpdateTrainingMethodDto);
    expect(res).toEqual({ id: 1 });
  });

  test('shareWorkoutProgram makes program public when no user', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({
      id: 1,
      userId: 1,
    } as any);
    prisma.workoutProgram.update.mockResolvedValue({ id: 1 } as any);
    const res = await service.shareWorkoutProgram(1, 2, null);
    expect(prisma.workoutProgram.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {},
    });
    expect(res).toEqual({ id: 1 });
  });

  test('shareWorkoutProgram requires owner id', async () => {
    await expect(service.shareWorkoutProgram(0 as any, 1, null)).rejects.toThrow('Unauthorized');
  });

  test('shareWorkoutProgram enforces ownership', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 3, userId: 9 } as any);

    await expect(service.shareWorkoutProgram(1, 3, null)).rejects.toThrow(
      'Unauthorized program access',
    );
  });

  test('createWorkoutPlan maps groups and preset experience level', async () => {
    permission.getUserRoles.mockResolvedValue({ userRoles: ['PREMIUM_USER'] } as any);
    permission.verifyPremiumAccess.mockReturnValue(true);
    prisma.intensityPreset.findUnique.mockResolvedValue({ experienceLevelId: 7 } as any);
    prisma.workoutPlan.create.mockResolvedValue({ id: 42 } as any);
    prisma.workoutPlanGroup.create.mockResolvedValueOnce({ id: 99 } as any);

    const input = {
      name: 'with groups',
      description: 'plan',
      intensityPresetId: 5,
      groups: [{ id: 5, trainingMethodId: 6 }],
      exercises: [
        {
          exerciseId: 3,
          groupId: 5,
          targetSets: 4,
          order: 1,
        },
      ],
    };

    await service.createWorkoutPlan(1, input as any);

    expect(prisma.workoutPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        experienceLevelId: 7,
        intensityPresetId: 5,
      }),
    });
    expect(prisma.workoutPlanGroup.create).toHaveBeenCalledWith({
      data: { workoutPlanId: 42, trainingMethodId: 6, order: 0 },
    });
    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          workoutPlanId: 42,
          exerciseId: 3,
          groupId: 99,
          order: 1,
          targetSets: 4,
          targetMetrics: [],
          isWarmup: false,
        }),
      ]),
    });
  });

  test('createWorkoutPlanVersion copies muscle groups and exercises', async () => {
    prisma.workoutPlan.findUnique
      .mockResolvedValueOnce({ userId: 1, sharedWith: [] } as any)
      .mockResolvedValueOnce({ userId: 1 } as any);
    prisma.workoutPlan.count.mockResolvedValue(0 as any);
    prisma.intensityPreset.findUnique.mockResolvedValue({ experienceLevelId: 11 } as any);
    prisma.workoutPlan.create.mockResolvedValue({ id: 55 } as any);
    prisma.workoutPlanGroup.create.mockResolvedValueOnce({ id: 101 } as any);
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(false);

    const result = await service.createWorkoutPlanVersion(1, 10, {
      name: 'Version',
      description: 'desc',
      intensityPresetId: 8,
      muscleGroupIds: [3],
      groups: [{ id: 9, trainingMethodId: 4 }],
      exercises: [{ exerciseId: 12, groupId: 9 }],
    } as any);

    expect(prisma.workoutPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentPlanId: 10,
        version: 2,
        experienceLevelId: 11,
        muscleGroups: { connect: [{ id: 3 }] },
      }),
    });
    expect(prisma.workoutPlanExercise.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ groupId: 101 })]),
    });
    expect(result).toEqual({ id: 55 });
  });

  test('createWorkoutPlanVersion rejects when caller is not original creator', async () => {
    permission.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permission.verifyAppRoles.mockReturnValue(true);
    prisma.workoutPlan.findUnique
      .mockResolvedValueOnce({ userId: 99, sharedWith: [] } as any)
      .mockResolvedValueOnce({ userId: 2 } as any);

    await expect(service.createWorkoutPlanVersion(1, 6, { name: 'new' } as any)).rejects.toThrow(
      'Only the original creator can version this workout',
    );
  });

  test('createTrainingGoal enforces permissions', async () => {
    prisma.trainingGoal.create.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.createTrainingGoal(ctx, { name: 'goal' } as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateTrainingGoal forwards updates', async () => {
    prisma.trainingGoal.update.mockResolvedValue({ id: 2 } as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.updateTrainingGoal(ctx, 2, { name: 'goal' } as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    expect(res).toEqual({ id: 2 });
  });

  test('deleteTrainingGoal enforces admin permission', async () => {
    prisma.trainingGoal.delete.mockResolvedValue({} as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.deleteTrainingGoal(ctx, 3);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(res).toBe(true);
  });

  test('createIntensityPreset persists metric defaults', async () => {
    prisma.intensityPreset.create.mockResolvedValue({ id: 1 } as any);

    const res = await service.createIntensityPreset(
      {} as any,
      {
        name: 'preset',
        metricDefaults: [{ metricId: 2, defaultMin: 1, defaultMax: 3 }],
      } as any,
    );

    expect(mockedVerifyRoles).toHaveBeenCalledWith(
      {},
      {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      },
    );
    expect(prisma.intensityPreset.create).toHaveBeenCalledWith({
      data: {
        name: 'preset',
        metricDefaults: {
          create: [{ metricId: 2, defaultMin: 1, defaultMax: 3 }],
        },
      },
      include: { metricDefaults: true },
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateIntensityPreset replaces metric defaults within transaction', async () => {
    prisma.intensityPreset.findUnique.mockResolvedValue({ id: 4, metricDefaults: [] } as any);

    const res = await service.updateIntensityPreset({} as any, 4, {
      name: 'updated',
      metricDefaults: [{ metricId: 9, defaultMin: 2 }],
    } as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(
      {},
      {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      },
    );
    expect(prisma.intensityMetricDefault.deleteMany).toHaveBeenCalledWith({
      where: { presetId: 4 },
    });
    expect(prisma.intensityMetricDefault.createMany).toHaveBeenCalledWith({
      data: [{ metricId: 9, defaultMin: 2, defaultMax: null, presetId: 4 }],
    });
    expect(prisma.intensityPreset.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { name: 'updated' },
    });
    expect(prisma.intensityPreset.findUnique).toHaveBeenCalledWith({
      where: { id: 4 },
      include: { metricDefaults: true },
    });
    expect(res).toEqual({ id: 4, metricDefaults: [] });
  });

  test('deleteIntensityPreset enforces admin requirement', async () => {
    prisma.intensityPreset.delete.mockResolvedValue({} as any);

    const res = await service.deleteIntensityPreset({} as any, 8);

    expect(mockedVerifyRoles).toHaveBeenCalledWith({}, { requireAppRole: 'ADMIN' });
    expect(res).toBe(true);
  });

  test('getExperienceLevels returns ordered levels', async () => {
    prisma.experienceLevel.findMany.mockResolvedValue([{ id: 1 }] as any);

    const res = await service.getExperienceLevels();

    expect(prisma.experienceLevel.findMany).toHaveBeenCalledWith({ orderBy: { id: 'asc' } });
    expect(res).toEqual([{ id: 1 }]);
  });

  test('createExperienceLevel validates and creates', async () => {
    prisma.experienceLevel.create.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: 'ADMIN' } as any;
    const input = { name: 'Beginner', description: 'desc' };

    const res = await service.createExperienceLevel(ctx, input as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateExperienceLevelDto);
    expect(res).toEqual({ id: 1 });
  });

  test('updateExperienceLevel validates and updates', async () => {
    prisma.experienceLevel.update.mockResolvedValue({ id: 2 } as any);
    const ctx = { appRole: 'ADMIN' } as any;
    const input = { name: 'Intermediate' };

    const res = await service.updateExperienceLevel(ctx, 2, input as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateExperienceLevelDto);
    expect(res).toEqual({ id: 2 });
  });

  test('deleteExperienceLevel removes record', async () => {
    prisma.experienceLevel.delete.mockResolvedValue({} as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.deleteExperienceLevel(ctx, 5);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(res).toBe(true);
  });

  test('createMuscleGroup connects body parts', async () => {
    prisma.muscleGroup.create.mockResolvedValue({ id: 1 } as any);
    const ctx = { appRole: 'ADMIN' } as any;
    const input = { name: 'Chest', slug: 'chest', bodyPartIds: [3] };

    const res = await service.createMuscleGroup(ctx, input as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    expect(prisma.muscleGroup.create).toHaveBeenCalledWith({
      data: {
        name: 'Chest',
        slug: 'chest',
        bodyParts: { connect: [{ id: 3 }] },
      },
      include: { bodyParts: true },
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateMuscleGroup sets body parts', async () => {
    prisma.muscleGroup.update.mockResolvedValue({ id: 2 } as any);
    const ctx = { appRole: 'ADMIN' } as any;
    const input = { name: 'Back', slug: 'back', bodyPartIds: [4] };

    const res = await service.updateMuscleGroup(ctx, 2, input as any);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    expect(prisma.muscleGroup.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        name: 'Back',
        slug: 'back',
        bodyParts: { set: [{ id: 4 }] },
      },
      include: { bodyParts: true },
    });
    expect(res).toEqual({ id: 2 });
  });

  test('deleteMuscleGroup removes entity', async () => {
    prisma.muscleGroup.delete.mockResolvedValue({} as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.deleteMuscleGroup(ctx, 9);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(res).toBe(true);
  });

  test('deleteTrainingMethod removes entity', async () => {
    prisma.trainingMethod.delete.mockResolvedValue({} as any);
    const ctx = { appRole: 'ADMIN' } as any;

    const res = await service.deleteTrainingMethod(ctx, 6);

    expect(mockedVerifyRoles).toHaveBeenCalledWith(ctx, { requireAppRole: 'ADMIN' });
    expect(res).toBe(true);
  });

  test('updateTrainingMethodGoals sets goal relations', async () => {
    prisma.trainingMethod.update.mockResolvedValue({ id: 3, trainingGoals: [] } as any);

    const res = await service.updateTrainingMethodGoals(
      {} as any,
      { methodId: 3, goalIds: [1, 2] } as any,
    );

    expect(mockedVerifyRoles).toHaveBeenCalledWith(
      {},
      {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      },
    );
    expect(mockedValidate).toHaveBeenCalledWith(
      { methodId: 3, goalIds: [1, 2] },
      UpdateTrainingMethodGoalsDto,
    );
    expect(prisma.trainingMethod.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { trainingGoals: { set: [{ id: 1 }, { id: 2 }] } },
      include: { trainingGoals: true },
    });
    expect(res).toEqual({ id: 3, trainingGoals: [] });
  });

  test('shareWorkoutProgram shares with user when provided', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 2, userId: 1 } as any);
    sharing.shareWorkoutProgram.mockResolvedValue({ id: 5 } as any);

    const res = await service.shareWorkoutProgram(1, 2, 9);

    expect(sharing.shareWorkoutProgram).toHaveBeenCalledWith(1, 2, 9, 'VIEW');
    expect(res).toEqual({ id: 5 });
  });

  test('getWorkoutPrograms returns user programs', async () => {
    prisma.workoutProgram.findMany.mockResolvedValue([{ id: 1 }] as any);

    const res = await service.getWorkoutPrograms(4);

    expect(prisma.workoutProgram.findMany).toHaveBeenCalledWith({
      where: { userId: 4 },
      include: { days: true, cooldowns: true, assignments: true },
    });
    expect(res).toEqual([{ id: 1 }]);
  });

  test('getWorkoutProgramById returns program for owner', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 3, userId: 1 } as any);

    const res = await service.getWorkoutProgramById(1, 3);

    expect(prisma.workoutProgram.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      include: { days: true, cooldowns: true, assignments: true },
    });
    expect(res).toEqual({ id: 3, userId: 1 });
  });

  test('getWorkoutProgramById throws when unauthorized', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 3, userId: 5 } as any);

    await expect(service.getWorkoutProgramById(1, 3)).rejects.toThrow('Unauthorized');
  });

  test('createWorkoutProgram validates and creates', async () => {
    prisma.workoutProgram.create.mockResolvedValue({ id: 6 } as any);
    const input = { name: 'Program', description: 'desc' };

    const res = await service.createWorkoutProgram(7, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutProgramDto);
    expect(prisma.workoutProgram.create).toHaveBeenCalledWith({
      data: { ...input, userId: 7 },
    });
    expect(res).toEqual({ id: 6 });
  });

  test('updateWorkoutProgram updates when owner matches', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 4, userId: 1 } as any);
    prisma.workoutProgram.update.mockResolvedValue({ id: 4 } as any);
    const input = { name: 'Updated' };

    const res = await service.updateWorkoutProgram(1, 4, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateWorkoutProgramDto);
    expect(prisma.workoutProgram.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: input,
    });
    expect(res).toEqual({ id: 4 });
  });

  test('updateWorkoutProgram throws when unauthorized', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 4, userId: 2 } as any);

    await expect(service.updateWorkoutProgram(1, 4, { name: 'n' } as any)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('deleteWorkoutProgram removes program for owner', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 8, userId: 1 } as any);

    const res = await service.deleteWorkoutProgram(1, 8);

    expect(prisma.workoutProgram.delete).toHaveBeenCalledWith({ where: { id: 8 } });
    expect(res).toBe(true);
  });

  test('deleteWorkoutProgram throws when unauthorized', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 8, userId: 2 } as any);

    await expect(service.deleteWorkoutProgram(1, 8)).rejects.toThrow('Unauthorized');
  });

  test('createWorkoutProgramDay validates ownership', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 1, userId: 1 } as any);
    prisma.workoutProgramDay.create.mockResolvedValue({ id: 10 } as any);
    const input = { programId: 1, name: 'Day 1' };

    const res = await service.createWorkoutProgramDay(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutProgramDayDto);
    expect(prisma.workoutProgramDay.create).toHaveBeenCalledWith({ data: input });
    expect(res).toEqual({ id: 10 });
  });

  test('createWorkoutProgramDay throws when unauthorized', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 1, userId: 2 } as any);

    await expect(service.createWorkoutProgramDay(1, { programId: 1 } as any)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('updateWorkoutProgramDay enforces ownership', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({ id: 5, program: { userId: 1 } } as any);
    prisma.workoutProgramDay.update.mockResolvedValue({ id: 5 } as any);
    const input = { name: 'Updated day' };

    const res = await service.updateWorkoutProgramDay(1, 5, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateWorkoutProgramDayDto);
    expect(prisma.workoutProgramDay.update).toHaveBeenCalledWith({ where: { id: 5 }, data: input });
    expect(res).toEqual({ id: 5 });
  });

  test('updateWorkoutProgramDay throws when unauthorized', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({ id: 5, program: { userId: 2 } } as any);

    await expect(service.updateWorkoutProgramDay(1, 5, { name: 'n' } as any)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('deleteWorkoutProgramDay enforces ownership', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({ id: 6, program: { userId: 1 } } as any);

    const res = await service.deleteWorkoutProgramDay(1, 6);

    expect(prisma.workoutProgramDay.delete).toHaveBeenCalledWith({ where: { id: 6 } });
    expect(res).toBe(true);
  });

  test('deleteWorkoutProgramDay throws when unauthorized', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({ id: 6, program: { userId: 2 } } as any);

    await expect(service.deleteWorkoutProgramDay(1, 6)).rejects.toThrow('Unauthorized');
  });

  test('createWorkoutProgramCooldown enforces ownership', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 3, userId: 1 } as any);
    prisma.workoutProgramMuscleCooldown.create.mockResolvedValue({ id: 11 } as any);
    const input = { programId: 3, muscleGroupId: 2 };

    const res = await service.createWorkoutProgramCooldown(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutProgramCooldownDto);
    expect(prisma.workoutProgramMuscleCooldown.create).toHaveBeenCalledWith({ data: input });
    expect(res).toEqual({ id: 11 });
  });

  test('createWorkoutProgramCooldown throws when unauthorized', async () => {
    prisma.workoutProgram.findUnique.mockResolvedValue({ id: 3, userId: 2 } as any);

    await expect(service.createWorkoutProgramCooldown(1, { programId: 3 } as any)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('deleteWorkoutProgramCooldown enforces ownership', async () => {
    prisma.workoutProgramMuscleCooldown.findUnique.mockResolvedValue({
      id: 12,
      program: { userId: 1 },
    } as any);

    const res = await service.deleteWorkoutProgramCooldown(1, 12);

    expect(prisma.workoutProgramMuscleCooldown.delete).toHaveBeenCalledWith({ where: { id: 12 } });
    expect(res).toBe(true);
  });

  test('deleteWorkoutProgramCooldown throws when unauthorized', async () => {
    prisma.workoutProgramMuscleCooldown.findUnique.mockResolvedValue({
      id: 12,
      program: { userId: 2 },
    } as any);

    await expect(service.deleteWorkoutProgramCooldown(1, 12)).rejects.toThrow('Unauthorized');
  });

  test('createWorkoutProgramAssignment enforces ownership', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({
      id: 7,
      program: { userId: 1 },
    } as any);
    prisma.workoutProgramAssignment.create.mockResolvedValue({ id: 13 } as any);
    const input = { programDayId: 7, workoutPlanId: 4 };

    const res = await service.createWorkoutProgramAssignment(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutProgramAssignmentDto);
    expect(prisma.workoutProgramAssignment.create).toHaveBeenCalledWith({ data: input });
    expect(res).toEqual({ id: 13 });
  });

  test('createWorkoutProgramAssignment throws when unauthorized', async () => {
    prisma.workoutProgramDay.findUnique.mockResolvedValue({
      id: 7,
      program: { userId: 2 },
    } as any);

    await expect(
      service.createWorkoutProgramAssignment(1, { programDayId: 7 } as any),
    ).rejects.toThrow('Unauthorized');
  });

  test('deleteWorkoutProgramAssignment enforces ownership', async () => {
    prisma.workoutProgramAssignment.findUnique.mockResolvedValue({
      id: 14,
      programDay: { program: { userId: 1 } },
    } as any);

    const res = await service.deleteWorkoutProgramAssignment(1, 14);

    expect(prisma.workoutProgramAssignment.delete).toHaveBeenCalledWith({ where: { id: 14 } });
    expect(res).toBe(true);
  });

  test('deleteWorkoutProgramAssignment throws when unauthorized', async () => {
    prisma.workoutProgramAssignment.findUnique.mockResolvedValue({
      id: 14,
      programDay: { program: { userId: 2 } },
    } as any);

    await expect(service.deleteWorkoutProgramAssignment(1, 14)).rejects.toThrow('Unauthorized');
  });

  test('setUserWorkoutPreferences upserts preferences', async () => {
    prisma.userWorkoutPreferences.upsert.mockResolvedValue({ userId: 1 } as any);
    const input = { weeklyWorkouts: 4 };

    const res = await service.setUserWorkoutPreferences(1, input as any);

    expect(mockedValidate).toHaveBeenCalledWith(input, SetUserWorkoutPreferencesDto);
    expect(prisma.userWorkoutPreferences.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      update: input,
      create: { ...input, userId: 1 },
    });
    expect(res).toEqual({ userId: 1 });
  });

  test('getUserWorkoutPreferences returns preferences', async () => {
    prisma.userWorkoutPreferences.findUnique.mockResolvedValue({ userId: 1 } as any);

    const res = await service.getUserWorkoutPreferences(1);

    expect(prisma.userWorkoutPreferences.findUnique).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(res).toEqual({ userId: 1 });
  });
});
