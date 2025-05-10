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

  private async verifyExerciseLogOwnership(userId: number, logId: number) {
    const log = await this.prisma.exerciseLog.findUnique({
      where: { id: logId },
      select: { userId: true, gymId: true },
    });

    if (!log) throw new Error('Exercise log not found');

    const roles = await this.permissionService.getUserRoles(userId.toString());

    if (this.permissionService.verifyAppRoles(roles.appRoles, ['ADMIN'])) return;

    if (
      log.gymId &&
      this.permissionService.verifyGymRoles(roles.gymRoles, log.gymId.toString(), ['GYM_ADMIN'])
    ) {
      return;
    }

    if (log.userId === userId) return;

    throw new Error('Unauthorized access to exercise log');
  }

  async getExerciseLogs(userId: number) {
    const roles = await this.permissionService.getUserRoles(userId.toString());

    if (this.permissionService.verifyAppRoles(roles.appRoles, ['ADMIN'])) {
      return this.prisma.exerciseLog.findMany();
    }

    const gymsManaged = await this.prisma.gymManagementRole.findMany({
      where: { userId },
      select: { gymId: true },
    });

    return this.prisma.exerciseLog.findMany({
      where: {
        OR: [
          { userId },
          { gymId: { in: gymsManaged.map((g) => g.gymId) } },
        ],
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
        userId,
        workoutPlanId: data.workoutPlanId,
        exerciseId: data.exerciseId,
        gymId: data.gymId ?? null,
        sets: data.sets,
        reps: data.reps,
        weight: data.weight,
      },
    });
  }

  async updateExerciseLog(id: number, data: UpdateExerciseLogInput, userId: number) {
    await this.verifyExerciseLogOwnership(userId, id);
    await validateInput(data, UpdateExerciseLogDto);

    return this.prisma.exerciseLog.update({
      where: { id },
      data,
    });
  }

  async deleteExerciseLog(id: number, userId: number) {
    await this.verifyExerciseLogOwnership(userId, id);

    await this.prisma.exerciseLog.delete({
      where: { id },
    });

    return true;
  }
}
