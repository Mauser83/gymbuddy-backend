import { PrismaClient } from '../../lib/prisma';
import { PermissionService } from '../core/permission.service';
import { CreateExerciseInput, UpdateExerciseInput } from './exercise.types';
import { validateInput } from '../../middlewares/validation';
import { CreateExerciseDto, UpdateExerciseDto } from './exercise.dto';

export class ExerciseService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  private async verifyOwnership(userId: number, exerciseId: number) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { userId: true },
    });

    if (!exercise || exercise.userId !== userId) {
      throw new Error('Unauthorized exercise access');
    }
  }

  async createExercise(input: CreateExerciseInput, userId: number) {
    await validateInput(input, CreateExerciseDto); // validate, no return
  
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true },
    });
  
    if (
      !user ||
      !['PREMIUM_USER', 'PERSONAL_TRAINER', 'ADMIN'].includes(user.userRole)
    ) {
      throw new Error('Upgrade to premium to create exercises');
    }
  
    return this.prisma.exercise.create({
      data: {
        ...input,
        userId,
      },
    });
  }

  async getMyExercises(userId: number) {
    return this.prisma.exercise.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateExercise(id: number, input: UpdateExerciseInput, userId: number) {
    await this.verifyOwnership(userId, id);
    await validateInput(input, UpdateExerciseDto); // validate, no return
  
    return this.prisma.exercise.update({
      where: { id },
      data: input,
    });
  }

  async deleteExercise(id: number, userId: number) {
    await this.verifyOwnership(userId, id);

    await this.prisma.exercise.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return true;
  }
}
