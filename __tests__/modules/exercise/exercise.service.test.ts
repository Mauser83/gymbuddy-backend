import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { validateInput } from '../../../src/middlewares/validation';
import { verifyRoles } from '../../../src/modules/auth/auth.roles';
import { PermissionService } from '../../../src/modules/core/permission.service';
import {
  CreateExerciseDto,
  CreateExerciseTypeDto,
  UpdateExerciseTypeDto,
  CreateExerciseDifficultyDto,
  UpdateExerciseDifficultyDto,
  CreateBodyPartDto,
  UpdateBodyPartDto,
  CreateMuscleDto,
  UpdateMuscleDto,
  CreateMetricDto,
  UpdateMetricDto,
  CreateExerciseSuggestionDto,
  ApproveExerciseSuggestionDto,
  RejectExerciseSuggestionDto,
  ListExerciseSuggestionsDto,
} from '../../../src/modules/exercise/exercise.dto';
import { ExerciseService } from '../../../src/modules/exercise/exercise.service';
import { PrismaClient } from '../../../src/prisma';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles');

const mockedValidate = jest.mocked(validateInput as any);
const mockedVerify = jest.mocked(verifyRoles as any);

describe('ExerciseService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: ExerciseService;
  let permissionService: PermissionService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permissionService = {} as any;
    service = new ExerciseService(prisma, permissionService);
    mockedValidate.mockResolvedValue(undefined as any);
  });

  afterEach(() => jest.clearAllMocks());

  test('createExercise validates, checks role and creates slots/options', async () => {
    prisma.exercise.create.mockResolvedValue({ id: 1 } as any);
    prisma.exerciseEquipmentSlot.create.mockResolvedValue({ id: 10 } as any);
    const input: any = {
      name: 'ex',
      primaryMuscleIds: [1],
      secondaryMuscleIds: [2],
      difficultyId: 1,
      exerciseTypeId: 2,
      equipmentSlots: [
        {
          slotIndex: 0,
          isRequired: true,
          comment: 'c',
          options: [{ subcategoryId: 3 }],
        },
      ],
    };
    const ctx: any = {};
    const res = await service.createExercise(ctx, input, 1);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateExerciseDto);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.exercise.create).toHaveBeenCalled();
    expect(prisma.exerciseEquipmentSlot.create).toHaveBeenCalled();
    expect(prisma.exerciseEquipmentOption.createMany).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  describe('exercisesForEquipment', () => {
    test('returns exercises matching the equipment subcategory', async () => {
      prisma.gymEquipment.findUniqueOrThrow.mockResolvedValue({
        equipment: { subcategoryId: 12 },
      } as any);
      const exercises = [{ id: 1 }, { id: 2 }];
      prisma.exercise.findMany.mockResolvedValue(exercises as any);

      const result = await service.exercisesForEquipment(7);

      expect(prisma.gymEquipment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 7 },
        select: {
          id: true,
          equipment: {
            select: {
              subcategoryId: true,
            },
          },
        },
      });
      expect(prisma.exercise.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          equipmentSlots: {
            some: {
              options: {
                some: {
                  subcategoryId: 12,
                },
              },
            },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          videoUrl: true,
          exerciseTypeId: true,
          difficultyId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toBe(exercises);
    });

    test('returns empty array when equipment has no subcategory', async () => {
      prisma.gymEquipment.findUniqueOrThrow.mockResolvedValue({
        equipment: { subcategoryId: null },
      } as any);

      const result = await service.exercisesForEquipment(9);

      expect(result).toEqual([]);
      expect(prisma.exercise.findMany).not.toHaveBeenCalled();
    });
  });

  test('createExercise propagates verifyRoles error', async () => {
    mockedVerify.mockImplementation(() => {
      throw new Error('no');
    });
    await expect(service.createExercise({} as any, {} as any, 1)).rejects.toThrow('no');
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  describe('exercise suggestions', () => {
    const baseSuggestionInput: any = {
      exercise: {
        name: 'New Exercise',
        difficultyId: 1,
        exerciseTypeId: 2,
        primaryMuscleIds: [1],
        secondaryMuscleIds: [2],
        equipmentSlots: [
          {
            slotIndex: 0,
            isRequired: true,
            options: [{ subcategoryId: 10 }],
          },
        ],
      },
    };

    test('createExerciseSuggestion validates input and stores suggestion', async () => {
      prisma.exerciseSuggestion.create.mockResolvedValue({ id: 'c1', status: 'PENDING' } as any);

      const result = await service.createExerciseSuggestion(5, baseSuggestionInput);

      expect(mockedValidate).toHaveBeenCalledWith(baseSuggestionInput, CreateExerciseSuggestionDto);
      expect(prisma.exerciseSuggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          managerUserId: 5,
          name: 'New Exercise',
          difficultyId: 1,
          exerciseTypeId: 2,
          equipmentSlots: expect.anything(),
          status: 'PENDING',
        }),
        select: { id: true, status: true },
      });
      expect(result).toEqual({ id: 'c1', status: 'PENDING' });
    });

    test('createExerciseSuggestion throws when too many slots', async () => {
      const input = {
        exercise: {
          ...baseSuggestionInput.exercise,
          equipmentSlots: Array.from({ length: 6 }).map((_, idx) => ({
            slotIndex: idx,
            isRequired: true,
            options: [{ subcategoryId: idx + 1 }],
          })),
        },
      };

      await expect(service.createExerciseSuggestion(1, input)).rejects.toThrow(
        'A maximum of 5 equipment slots is allowed',
      );
      expect(prisma.exerciseSuggestion.create).not.toHaveBeenCalled();
    });

    test('createExerciseSuggestion throws when duplicate subcategory is provided', async () => {
      const input = {
        exercise: {
          ...baseSuggestionInput.exercise,
          equipmentSlots: [
            {
              slotIndex: 0,
              isRequired: true,
              options: [{ subcategoryId: 1 }],
            },
            {
              slotIndex: 1,
              isRequired: false,
              options: [{ subcategoryId: 1 }],
            },
          ],
        },
      };

      await expect(service.createExerciseSuggestion(1, input)).rejects.toThrow(
        'Duplicate equipment subcategory in suggestion',
      );
      expect(prisma.exerciseSuggestion.create).not.toHaveBeenCalled();
    });

    test('approveExerciseSuggestion creates exercise and marks suggestion approved', async () => {
      const context: any = { userId: 10 };
      prisma.exerciseSuggestion.findUnique.mockResolvedValue({
        id: 's1',
        status: 'PENDING',
        managerUserId: 20,
        name: 'Exercise',
        description: 'desc',
        videoUrl: 'url',
        difficultyId: 1,
        exerciseTypeId: 2,
        primaryMuscleIds: [1],
        secondaryMuscleIds: [2],
        equipmentSlots: [
          { slotIndex: 0, isRequired: true, options: [{ subcategoryId: 5 }] },
        ] as any,
      } as any);
      prisma.exerciseSuggestion.update.mockResolvedValue({} as any);
      const createExerciseSpy = jest
        .spyOn(service, 'createExercise')
        .mockResolvedValue({ id: 999 } as any);

      const result = await service.approveExerciseSuggestion(context, { id: 's1' });

      expect(mockedValidate).toHaveBeenCalledWith({ id: 's1' }, ApproveExerciseSuggestionDto);
      expect(createExerciseSpy).toHaveBeenCalledWith(
        context,
        expect.objectContaining({ name: 'Exercise', equipmentSlots: expect.any(Array) }),
        20,
      );
      expect(prisma.exerciseSuggestion.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'APPROVED', approvedExerciseId: 999, rejectedReason: null },
      });
      expect(result).toEqual({ approved: true, exerciseId: 999 });
    });

    test('approveExerciseSuggestion throws when suggestion missing', async () => {
      prisma.exerciseSuggestion.findUnique.mockResolvedValue(null as any);

      await expect(service.approveExerciseSuggestion({} as any, { id: 'missing' })).rejects.toThrow(
        'Suggestion not found',
      );
    });

    test('approveExerciseSuggestion throws when suggestion is not pending', async () => {
      prisma.exerciseSuggestion.findUnique.mockResolvedValue({
        id: 's1',
        status: 'APPROVED',
      } as any);

      await expect(service.approveExerciseSuggestion({} as any, { id: 's1' })).rejects.toThrow(
        'Suggestion is not pending',
      );
    });

    test('rejectExerciseSuggestion updates status and reason', async () => {
      prisma.exerciseSuggestion.findUnique.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.exerciseSuggestion.update.mockResolvedValue({} as any);

      const result = await service.rejectExerciseSuggestion({ id: 's1', reason: '  nope ' });

      expect(mockedValidate).toHaveBeenCalledWith(
        { id: 's1', reason: '  nope ' },
        RejectExerciseSuggestionDto,
      );
      expect(prisma.exerciseSuggestion.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'REJECTED', rejectedReason: 'nope', approvedExerciseId: null },
      });
      expect(result).toEqual({ rejected: true });
    });

    test('rejectExerciseSuggestion throws when suggestion not pending', async () => {
      prisma.exerciseSuggestion.findUnique.mockResolvedValue({ status: 'APPROVED' } as any);

      await expect(service.rejectExerciseSuggestion({ id: 's1' })).rejects.toThrow(
        'Suggestion is not pending',
      );
      expect(prisma.exerciseSuggestion.update).not.toHaveBeenCalled();
    });

    test('listExerciseSuggestions returns mapped items and pagination', async () => {
      prisma.exerciseSuggestion.findMany.mockResolvedValue([
        {
          id: 's1',
          status: 'PENDING',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          equipmentSlots: [{ slotIndex: 0, isRequired: true, options: [{ subcategoryId: 3 }] }],
          secondaryMuscleIds: null,
        },
        {
          id: 's2',
          status: 'PENDING',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          equipmentSlots: [],
          secondaryMuscleIds: [4],
        },
      ] as any);

      const result = await service.listExerciseSuggestions({ status: 'PENDING', limit: 1 });

      expect(mockedValidate).toHaveBeenCalledWith(
        { status: 'PENDING', limit: 1 },
        ListExerciseSuggestionsDto,
      );
      expect(prisma.exerciseSuggestion.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 2,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: 's1', equipmentSlots: expect.any(Array) });
      expect(result.items[0].secondaryMuscleIds).toEqual([]);
      expect(result.nextCursor).toBe('s1');
    });
  });

  test('getExercises forwards parameters to prisma', async () => {
    prisma.exercise.findMany.mockResolvedValue([] as any);
    await service.getExercises('a', {
      exerciseType: ['t'],
      difficulty: ['d'],
      bodyPart: ['b'],
      muscle: ['m'],
    });
    expect(prisma.exercise.findMany).toHaveBeenCalled();
  });

  test('getExercises without search', async () => {
    prisma.exercise.findMany.mockResolvedValue([] as any);
    await service.getExercises();
    expect(prisma.exercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
      }),
    );
  });

  test('getExerciseById returns result', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ id: 1 } as any);
    const res = await service.getExerciseById(1);
    expect(prisma.exercise.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(res).toEqual({ id: 1 });
  });

  test('getExerciseById returns null when not found', async () => {
    prisma.exercise.findUnique.mockResolvedValue(null as any);
    const res = await service.getExerciseById(1);
    expect(res).toBeNull();
  });

  test('getExercisesAvailableAtGym returns empty when no equipment', async () => {
    prisma.gymEquipment.findMany.mockResolvedValue([] as any);
    const res = await service.getExercisesAvailableAtGym(1);
    expect(res).toEqual([]);
    expect(prisma.exerciseEquipmentOption.findMany).not.toHaveBeenCalled();
  });

  test('getExercisesAvailableAtGym queries exercises when equipment exists', async () => {
    prisma.gymEquipment.findMany.mockResolvedValue([{ equipment: { subcategoryId: 5 } }] as any);
    prisma.exerciseEquipmentOption.findMany.mockResolvedValue([{ slot: { exerciseId: 2 } }] as any);
    prisma.exercise.findMany.mockResolvedValue([{ id: 2 }] as any);
    const res = await service.getExercisesAvailableAtGym(1, 'a');
    expect(prisma.exercise.findMany).toHaveBeenCalled();
    expect(res).toEqual([{ id: 2 }]);
  });

  test('updateExercise updates basic fields', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ userId: 1 } as any);
    prisma.exercise.update.mockResolvedValue({ id: 1 } as any);
    const res = await service.updateExercise(1, { name: 'n' } as any, 1);
    expect(prisma.exercise.update).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('updateExercise handles equipment slots', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ userId: 1 } as any);
    prisma.exercise.update.mockResolvedValue({ id: 1 } as any);
    prisma.exerciseEquipmentSlot.findMany.mockResolvedValue([{ id: 5 }] as any);
    prisma.exerciseEquipmentSlot.create.mockResolvedValue({ id: 6 } as any);
    const input: any = {
      equipmentSlots: [{ slotIndex: 0, isRequired: true, options: [{ subcategoryId: 2 }] }],
    };
    await service.updateExercise(1, input, 1);
    expect(prisma.exerciseEquipmentOption.deleteMany).toHaveBeenCalled();
    expect(prisma.exerciseEquipmentSlot.deleteMany).toHaveBeenCalled();
    expect(prisma.exerciseEquipmentSlot.create).toHaveBeenCalled();
    expect(prisma.exerciseEquipmentOption.createMany).toHaveBeenCalled();
  });

  test('updateExercise throws when unauthorized', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ userId: 2 } as any);
    await expect(service.updateExercise(1, {} as any, 1)).rejects.toThrow(
      'Unauthorized exercise access',
    );
  });

  test('deleteExercise soft deletes after ownership check', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ userId: 1 } as any);
    await service.deleteExercise(3, 1);
    expect(prisma.exercise.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  test('deleteExercise throws when unauthorized', async () => {
    prisma.exercise.findUnique.mockResolvedValue({ userId: 2 } as any);
    await expect(service.deleteExercise(3, 1)).rejects.toThrow('Unauthorized exercise access');
  });

  test('createExerciseType validates and inserts metrics', async () => {
    prisma.exerciseType.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 't', metrics: [{ metricId: 1, order: 1 }] };
    const res = await service.createExerciseType(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateExerciseTypeDto);
    expect(prisma.exerciseTypeMetric.createMany).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('updateExerciseType validates, updates and recreates metrics', async () => {
    prisma.exerciseType.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'n', metrics: [{ metricId: 2, order: 1 }] };
    const res = await service.updateExerciseType(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateExerciseTypeDto);
    expect(prisma.exerciseTypeMetric.deleteMany).toHaveBeenCalled();
    expect(prisma.exerciseTypeMetric.createMany).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('deleteExerciseType deletes type', async () => {
    await service.deleteExerciseType(2);
    expect(prisma.exerciseType.delete).toHaveBeenCalledWith({
      where: { id: 2 },
    });
  });

  test('createExerciseDifficulty validates and creates', async () => {
    prisma.exerciseDifficulty.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { level: 'l' };
    await service.createExerciseDifficulty(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateExerciseDifficultyDto);
    expect(prisma.exerciseDifficulty.create).toHaveBeenCalledWith({
      data: input,
    });
  });

  test('updateExerciseDifficulty validates and updates', async () => {
    prisma.exerciseDifficulty.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { level: 'L' };
    await service.updateExerciseDifficulty(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateExerciseDifficultyDto);
    expect(prisma.exerciseDifficulty.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: input,
    });
  });

  test('deleteExerciseDifficulty deletes', async () => {
    await service.deleteExerciseDifficulty(1);
    expect(prisma.exerciseDifficulty.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  test('createBodyPart validates and creates', async () => {
    prisma.bodyPart.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'b' };
    await service.createBodyPart(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateBodyPartDto);
    expect(prisma.bodyPart.create).toHaveBeenCalledWith({ data: input });
  });

  test('updateBodyPart validates and updates', async () => {
    prisma.bodyPart.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'b2' };
    await service.updateBodyPart(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateBodyPartDto);
    expect(prisma.bodyPart.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: input,
    });
  });

  test('deleteBodyPart deletes', async () => {
    await service.deleteBodyPart(2);
    expect(prisma.bodyPart.delete).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  test('createMuscle validates and creates', async () => {
    prisma.muscle.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'm', bodyPartId: 1 };
    await service.createMuscle(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateMuscleDto);
    expect(prisma.muscle.create).toHaveBeenCalledWith({ data: input });
  });

  test('updateMuscle validates and updates', async () => {
    prisma.muscle.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'm2', bodyPartId: 1 };
    await service.updateMuscle(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateMuscleDto);
    expect(prisma.muscle.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: input,
    });
  });

  test('deleteMuscle deletes', async () => {
    await service.deleteMuscle(3);
    expect(prisma.muscle.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  test('createMetric validates and creates', async () => {
    prisma.metric.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'm', slug: 's', unit: 'u', inputType: 'number' };
    await service.createMetric(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateMetricDto);
    expect(prisma.metric.create).toHaveBeenCalledWith({ data: input });
  });

  test('updateMetric validates and updates', async () => {
    prisma.metric.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { name: 'm2' };
    await service.updateMetric(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateMetricDto);
    expect(prisma.metric.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: input,
    });
  });

  test('deleteMetric deletes', async () => {
    await service.deleteMetric(4);
    expect(prisma.metric.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });
});
