import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaClient } from '../../../src/lib/prisma';
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
} from '../../../src/modules/exercise/exercise.dto';
import { ExerciseService } from '../../../src/modules/exercise/exercise.service';

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

  test('createExercise propagates verifyRoles error', async () => {
    mockedVerify.mockImplementation(() => {
      throw new Error('no');
    });
    await expect(service.createExercise({} as any, {} as any, 1)).rejects.toThrow('no');
    expect(prisma.exercise.create).not.toHaveBeenCalled();
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
