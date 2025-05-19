import { PrismaClient } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import { validateInput } from "../../middlewares/validation";

import {
  CreateExerciseInput,
  UpdateExerciseInput,
  CreateExerciseTypeInput,
  UpdateExerciseTypeInput,
  CreateExerciseDifficultyInput,
  UpdateExerciseDifficultyInput,
  CreateBodyPartInput,
  UpdateBodyPartInput,
  CreateMuscleInput,
  UpdateMuscleInput,
} from "./exercise.types";

import {
  CreateExerciseDto,
  UpdateExerciseDto,
  CreateExerciseTypeDto,
  UpdateExerciseTypeDto,
  CreateExerciseDifficultyDto,
  UpdateExerciseDifficultyDto,
  CreateBodyPartDto,
  UpdateBodyPartDto,
  CreateMuscleDto,
  UpdateMuscleDto,
} from "./exercise.dto";

export class ExerciseService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  // ---------- EXERCISE CORE ----------

  private async verifyOwnership(userId: number, exerciseId: number) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { userId: true },
    });

    if (!exercise || exercise.userId !== userId) {
      throw new Error("Unauthorized exercise access");
    }
  }

  async createExercise(input: CreateExerciseInput, userId: number) {
    await validateInput(input, CreateExerciseDto);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true },
    });

    if (
      !user ||
      !["PREMIUM_USER", "PERSONAL_TRAINER", "ADMIN"].includes(user.userRole)
    ) {
      throw new Error("Upgrade to premium to create exercises");
    }

    const {
      primaryMuscleIds,
      secondaryMuscleIds,
      difficultyId,
      exerciseTypeId,
      ...exerciseData
    } = input;

    const data: any = {
      ...exerciseData,
      userId,
    };

    if (difficultyId) {
      data.difficultyId = difficultyId; // ✅
    }

    if (exerciseTypeId) {
      data.exerciseTypeId = exerciseTypeId; // ✅
    }

    if (primaryMuscleIds?.length) {
      data.primaryMuscles = {
        connect: primaryMuscleIds.map((id) => ({ id })),
      };
    }

    if (secondaryMuscleIds?.length) {
      data.secondaryMuscles = {
        connect: secondaryMuscleIds.map((id) => ({ id })),
      };
    }

    const createdExercise = await this.prisma.exercise.create({ data });

    return createdExercise;
  }

  async getMyExercises(userId: number) {
    return this.prisma.exercise.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
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

    const data: any = { ...exerciseData };

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
      data: { deletedAt: new Date() },
    });

    return true;
  }

  // ---------- REFERENCE ENTITIES ----------

  // Exercise Type
  async createExerciseType(input: CreateExerciseTypeInput) {
    await validateInput(input, CreateExerciseTypeDto);
    return this.prisma.exerciseType.create({ data: input });
  }

  async updateExerciseType(id: number, input: UpdateExerciseTypeInput) {
    await validateInput(input, UpdateExerciseTypeDto);
    return this.prisma.exerciseType.update({ where: { id }, data: input });
  }

  async deleteExerciseType(id: number) {
    await this.prisma.exerciseType.delete({ where: { id } });
    return true;
  }

  // Difficulty
  async createExerciseDifficulty(input: CreateExerciseDifficultyInput) {
    await validateInput(input, CreateExerciseDifficultyDto);
    return this.prisma.exerciseDifficulty.create({ data: input });
  }

  async updateExerciseDifficulty(
    id: number,
    input: UpdateExerciseDifficultyInput
  ) {
    await validateInput(input, UpdateExerciseDifficultyDto);
    return this.prisma.exerciseDifficulty.update({
      where: { id },
      data: input,
    });
  }

  async deleteExerciseDifficulty(id: number) {
    await this.prisma.exerciseDifficulty.delete({ where: { id } });
    return true;
  }

  // Body Part
  async createBodyPart(input: CreateBodyPartInput) {
    await validateInput(input, CreateBodyPartDto);
    return this.prisma.bodyPart.create({ data: input });
  }

  async updateBodyPart(id: number, input: UpdateBodyPartInput) {
    await validateInput(input, UpdateBodyPartDto);
    return this.prisma.bodyPart.update({ where: { id }, data: input });
  }

  async deleteBodyPart(id: number) {
    await this.prisma.bodyPart.delete({ where: { id } });
    return true;
  }

  // Muscle
  async createMuscle(input: CreateMuscleInput) {
    await validateInput(input, CreateMuscleDto);
    return this.prisma.muscle.create({ data: input });
  }

  async updateMuscle(id: number, input: UpdateMuscleInput) {
    await validateInput(input, UpdateMuscleDto);
    return this.prisma.muscle.update({ where: { id }, data: input });
  }

  async deleteMuscle(id: number) {
    await this.prisma.muscle.delete({ where: { id } });
    return true;
  }
}
