import { ExerciseLogService } from '../../../src/modules/exerciselog/exerciselog.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '../../../src/lib/prisma';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { validateInput } from '../../../src/middlewares/validation';
import {
  CreateExerciseLogDto,
  UpdateExerciseLogDto,
  CreateWorkoutSessionDto,
  UpdateWorkoutSessionDto,
} from '../../../src/modules/exerciselog/exerciselog.dto';

jest.mock('../../../src/middlewares/validation');

const mockedValidate = jest.mocked(validateInput as any);

describe('ExerciseLogService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: ExerciseLogService;
  let permissionService: {
    getUserRoles: jest.Mock;
    verifyAppRoles: jest.Mock;
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permissionService = {
      getUserRoles: jest.fn(),
      verifyAppRoles: jest.fn(),
    } as any;
    service = new ExerciseLogService(prisma, permissionService as any);
    mockedValidate.mockResolvedValue(undefined as any);
  });

  afterEach(() => jest.clearAllMocks());

  test('getExerciseLogs returns all logs for admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] } as any);
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.exerciseLog.findMany.mockResolvedValue([{ id: 1 }] as any);

    const res = await service.getExerciseLogs(1);
    expect(prisma.exerciseLog.findMany).toHaveBeenCalledWith();
    expect(res).toEqual([{ id: 1 }]);
  });

  test('getExerciseLogs filters by user when not admin', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] } as any);
    permissionService.verifyAppRoles.mockReturnValue(false);
    prisma.exerciseLog.findMany.mockResolvedValue([{ id: 2 }] as any);

    const res = await service.getExerciseLogs(5);
    expect(prisma.exerciseLog.findMany).toHaveBeenCalledWith({
      where: { workoutSession: { userId: 5 } },
      include: { workoutSession: true },
    });
    expect(res).toEqual([{ id: 2 }]);
  });

  test('createExerciseLog validates input and creates equipment links', async () => {
    prisma.exerciseLog.create.mockResolvedValue({ id: 1 } as any);

    const input: any = {
      exerciseId: 1,
      workoutSessionId: 2,
      setNumber: 1,
      metrics: { 1: 10 },
      notes: 'n',
      equipmentIds: [3, 4],
    };

    const res = await service.createExerciseLog(input, 1);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateExerciseLogDto);
    expect(prisma.exerciseLog.create).toHaveBeenCalledWith({
      data: {
        exerciseId: 1,
        workoutSessionId: 2,
        setNumber: 1,
        metrics: { 1: 10 },
        notes: 'n',
      },
    });
    expect(prisma.exerciseLogEquipment.createMany).toHaveBeenCalledWith({
      data: [
        { exerciseLogId: 1, gymEquipmentId: 3 },
        { exerciseLogId: 1, gymEquipmentId: 4 },
      ],
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateExerciseLog updates metrics and equipment', async () => {
    prisma.exerciseLog.update.mockResolvedValue({ id: 1 } as any);

    const input: any = {
      setNumber: 2,
      metrics: { 2: 20 },
      equipmentIds: [5],
    };

    const res = await service.updateExerciseLog(1, input);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateExerciseLogDto);
    expect(prisma.exerciseLog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        setNumber: 2,
        metrics: { 2: 20 },
      },
    });
    expect(prisma.exerciseLogEquipment.deleteMany).toHaveBeenCalledWith({ where: { exerciseLogId: 1 } });
    expect(prisma.exerciseLogEquipment.createMany).toHaveBeenCalledWith({
      data: [{ exerciseLogId: 1, gymEquipmentId: 5 }],
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateExerciseLog without optional fields does minimal update', async () => {
    prisma.exerciseLog.update.mockResolvedValue({ id: 1 } as any);

    const res = await service.updateExerciseLog(1, { setNumber: 1 });
    expect(prisma.exerciseLog.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { setNumber: 1 },
    });
    expect(prisma.exerciseLogEquipment.deleteMany).not.toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('deleteExerciseLog removes record', async () => {
    prisma.exerciseLog.delete.mockResolvedValue({} as any);
    const res = await service.deleteExerciseLog(3, 1);
    expect(prisma.exerciseLog.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(res).toBe(true);
  });

  test('createWorkoutSession validates and creates', async () => {
    prisma.workoutSession.findFirst.mockResolvedValue(null as any);
    prisma.workoutSession.create.mockResolvedValue({ id: 10 } as any);

    const input: any = { userId: 1, gymId: 2, startedAt: '2020-01-01' };
    const res = await service.createWorkoutSession(input, 1);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateWorkoutSessionDto);
    expect(prisma.workoutSession.create).toHaveBeenCalledWith({
      data: {
        userId: 1,
        gymId: 2,
        startedAt: new Date('2020-01-01'),
        workoutPlanId: null,
        assignedWorkoutId: null,
        notes: null,
      },
    });
    expect(res).toEqual({ id: 10 });
  });

  test('createWorkoutSession throws for mismatched user', async () => {
    await expect(
      service.createWorkoutSession({ userId: 2, gymId: 1, startedAt: '2020' } as any, 1)
    ).rejects.toThrow('You are not authorized');
  });

  test('createWorkoutSession throws when active session exists', async () => {
    prisma.workoutSession.findFirst.mockResolvedValue({ id: 1 } as any);
    await expect(
      service.createWorkoutSession({ userId: 1, gymId: 1, startedAt: '2020' } as any, 1)
    ).rejects.toThrow('You already have an active workout session.');
  });

  test('updateWorkoutSession updates session', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue({ userId: 1 } as any);
    prisma.workoutSession.update.mockResolvedValue({ id: 1 } as any);

    const input: any = { endedAt: '2020-01-02', notes: 'n' };
    const res = await service.updateWorkoutSession(1, input, 1);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateWorkoutSessionDto);
    expect(prisma.workoutSession.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { endedAt: new Date('2020-01-02'), notes: 'n' },
    });
    expect(res).toEqual({ id: 1 });
  });

  test('updateWorkoutSession throws when not found', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue(null as any);
    await expect(service.updateWorkoutSession(1, {}, 1)).rejects.toThrow('WorkoutSession not found');
  });

  test('updateWorkoutSession throws when unauthorized', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue({ userId: 2 } as any);
    await expect(service.updateWorkoutSession(1, {}, 1)).rejects.toThrow('Unauthorized');
  });

  test('deleteWorkoutSession cleans up logs and session', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue({ userId: 1 } as any);
    prisma.exerciseLog.deleteMany.mockResolvedValue({} as any);
    prisma.workoutSession.delete.mockResolvedValue({} as any);

    const res = await service.deleteWorkoutSession(2, 1);
    expect(prisma.exerciseLog.deleteMany).toHaveBeenCalledWith({ where: { workoutSessionId: 2 } });
    expect(prisma.workoutSession.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(res).toBe(true);
  });

  test('deleteWorkoutSession throws when not found', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue(null as any);
    await expect(service.deleteWorkoutSession(1, 1)).rejects.toThrow('Session not found');
  });

  test('deleteWorkoutSession throws when unauthorized', async () => {
    prisma.workoutSession.findUnique.mockResolvedValue({ userId: 2 } as any);
    await expect(service.deleteWorkoutSession(1, 1)).rejects.toThrow('Unauthorized');
  });

  test('getActiveWorkoutSession queries prisma', async () => {
    prisma.workoutSession.findFirst.mockResolvedValue({ id: 1 } as any);
    const res = await service.getActiveWorkoutSession(1);
    expect(prisma.workoutSession.findFirst).toHaveBeenCalledWith({
      where: { userId: 1, endedAt: null },
    });
    expect(res).toEqual({ id: 1 });
  });
});