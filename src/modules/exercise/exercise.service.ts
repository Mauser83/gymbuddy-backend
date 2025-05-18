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
    await validateInput(input, CreateExerciseDto);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true },
    });

    if (!user || !['PREMIUM_USER', 'PERSONAL_TRAINER', 'ADMIN'].includes(user.userRole)) {
      throw new Error('Upgrade to premium to create exercises');
    }

    const { equipmentIds, ...exerciseData } = input;

    const createdExercise = await this.prisma.exercise.create({
      data: {
        ...exerciseData,
        userId,
      },
    });

    if (equipmentIds?.length) {
      await this.prisma.exerciseEquipment.createMany({
        data: equipmentIds.map((equipmentId) => ({
          exerciseId: createdExercise.id,
          equipmentId,
        })),
        skipDuplicates: true,
      });
    }

    return createdExercise;
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
    await validateInput(input, UpdateExerciseDto);

    const { equipmentIds, ...exerciseData } = input;

    const updatedExercise = await this.prisma.exercise.update({
      where: { id },
      data: exerciseData,
    });

    if (equipmentIds) {
      // Remove old links
      await this.prisma.exerciseEquipment.deleteMany({
        where: { exerciseId: id },
      });

      // Insert new ones
      if (equipmentIds.length > 0) {
        await this.prisma.exerciseEquipment.createMany({
          data: equipmentIds.map((equipmentId) => ({
            exerciseId: id,
            equipmentId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updatedExercise;
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
