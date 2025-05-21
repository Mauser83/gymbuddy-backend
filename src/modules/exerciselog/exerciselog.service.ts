import { PrismaClient } from '../../lib/prisma';
import { PermissionService } from '../core/permission.service';
import { CreateExerciseLogInput, UpdateExerciseLogInput } from './exerciselog.types';
import { validateInput } from '../../middlewares/validation';
import { CreateExerciseLogDto, UpdateExerciseLogDto } from './exerciselog.dto';

export class ExerciseLogService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  async getExerciseLogs(userId: number) {
    const roles = await this.permissionService.getUserRoles(userId);

    if (this.permissionService.verifyAppRoles(roles.appRoles, ['ADMIN'])) {
      return this.prisma.exerciseLog.findMany();
    }

    // fallback to session-based ownership filtering
    return this.prisma.exerciseLog.findMany({
      where: {
        workoutSession: {
          userId: userId,
        },
      },
      include: {
        workoutSession: true,
      },
    });
  }

  async createExerciseLog(data: CreateExerciseLogInput, userId: number) {
    await validateInput(data, CreateExerciseLogDto);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true },
    });

    if (!user || !['PREMIUM_USER', 'PERSONAL_TRAINER', 'ADMIN'].includes(user.userRole)) {
      throw new Error('Upgrade to premium to create exercise logs');
    }

    return this.prisma.exerciseLog.create({
      data: {
        exerciseId: data.exerciseId,
        gymEquipmentId: data.gymEquipmentId,
        workoutSessionId: data.workoutSessionId,
        setNumber: data.setNumber,
        reps: data.reps,
        weight: data.weight,
        rpe: data.rpe ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async updateExerciseLog(id: number, data: UpdateExerciseLogInput, userId: number) {
    // Optional: Add ownership validation based on workoutSession.userId if desired
    await validateInput(data, UpdateExerciseLogDto);

    return this.prisma.exerciseLog.update({
      where: { id },
      data,
    });
  }

  async deleteExerciseLog(id: number, userId: number) {
    // Optional: Add ownership validation if necessary
    await this.prisma.exerciseLog.delete({
      where: { id },
    });

    return true;
  }
}
