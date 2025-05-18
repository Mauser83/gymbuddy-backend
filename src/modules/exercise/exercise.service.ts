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

    const {
      equipmentIds,
      primaryMuscleIds,
      secondaryMuscleIds,
      difficultyId,
      exerciseTypeId,
      ...exerciseData
    } = input;

    const data: any = {
      ...exerciseData,
      userId,
      primaryMuscles: {
        connect: primaryMuscleIds.map((id) => ({ id })),
      },
      secondaryMuscles: {
        connect: secondaryMuscleIds?.map((id) => ({ id })) ?? [],
      },
    };

    if (difficultyId) {
      data.difficulty = { connect: { id: difficultyId } };
    }

    if (exerciseTypeId) {
      data.exerciseType = { connect: { id: exerciseTypeId } };
    }

    const createdExercise = await this.prisma.exercise.create({ data });

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

    const {
      equipmentIds,
      primaryMuscleIds,
      secondaryMuscleIds,
      difficultyId,
      exerciseTypeId,
      ...exerciseData
    } = input;

    const data: any = {
      ...exerciseData,
    };

    if (difficultyId !== undefined) {
      data.difficulty = { connect: { id: difficultyId } };
    }

    if (exerciseTypeId !== undefined) {
      data.exerciseType = { connect: { id: exerciseTypeId } };
    }

    if (primaryMuscleIds) {
      data.primaryMuscles = {
        set: primaryMuscleIds.map((id) => ({ id })),
      };
    }

    if (secondaryMuscleIds) {
      data.secondaryMuscles = {
        set: secondaryMuscleIds.map((id) => ({ id })),
      };
    }

    const updatedExercise = await this.prisma.exercise.update({
      where: { id },
      data,
    });

    if (equipmentIds) {
      await this.prisma.exerciseEquipment.deleteMany({
        where: { exerciseId: id },
      });

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
