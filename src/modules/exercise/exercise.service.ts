import { PrismaClient } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import { validateInput } from "../../middlewares/validation";
import { ExerciseQueryFilters } from "./exercise.types";

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
      equipmentSlots,
      ...exerciseData
    } = input;

    const createdExercise = await this.prisma.exercise.create({
      data: {
        ...exerciseData,
        userId,
        difficultyId,
        exerciseTypeId,
        primaryMuscles: {
          connect: primaryMuscleIds.map((id) => ({ id })),
        },
        secondaryMuscles: {
          connect: secondaryMuscleIds?.map((id) => ({ id })) || [],
        },
      },
    });

    // Create slots + options
    for (const slot of equipmentSlots) {
      const createdSlot = await this.prisma.exerciseEquipmentSlot.create({
        data: {
          slotIndex: slot.slotIndex,
          isRequired: slot.isRequired,
          comment: slot.comment,
          exerciseId: createdExercise.id,
        },
      });

      await this.prisma.exerciseEquipmentOption.createMany({
        data: slot.options.map((opt) => ({
          slotId: createdSlot.id,
          subcategoryId: opt.subcategoryId,
        })),
      });
    }

    return createdExercise;
  }

  async getExercises(search?: string, filters?: ExerciseQueryFilters) {
    const whereClause: any = {
      deletedAt: null,
      AND: [],
    };

    // Add full-text-like search
    if (search) {
      const orClause: any[] = [
        { name: { contains: search, mode: "insensitive" as const } },
      ];

      if (!filters?.difficulty?.length) {
        orClause.push({
          difficulty: {
            level: { contains: search, mode: "insensitive" as const },
          },
        });
      }

      if (!filters?.exerciseType?.length) {
        orClause.push({
          exerciseType: {
            name: { contains: search, mode: "insensitive" as const },
          },
        });
      }

      if (!filters?.muscle?.length) {
        orClause.push(
          {
            primaryMuscles: {
              some: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          },
          {
            secondaryMuscles: {
              some: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          }
        );
      }

      if (!filters?.bodyPart?.length) {
        orClause.push(
          {
            primaryMuscles: {
              some: {
                bodyPart: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          },
          {
            secondaryMuscles: {
              some: {
                bodyPart: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          }
        );
      }

      whereClause.AND.push({ OR: orClause });
    }

    // Add structured filters
    if (filters?.exerciseType?.length) {
      whereClause.AND.push({
        exerciseType: {
          name: { in: filters.exerciseType },
        },
      });
    }

    if (filters?.difficulty?.length) {
      whereClause.AND.push({
        difficulty: {
          level: { in: filters.difficulty },
        },
      });
    }

    if (filters?.bodyPart?.length) {
      whereClause.AND.push({
        OR: [
          {
            primaryMuscles: {
              some: { bodyPart: { name: { in: filters.bodyPart } } },
            },
          },
          {
            secondaryMuscles: {
              some: { bodyPart: { name: { in: filters.bodyPart } } },
            },
          },
        ],
      });
    }

    if (filters?.muscle?.length) {
      whereClause.AND.push({
        OR: [
          {
            primaryMuscles: {
              some: { name: { in: filters.muscle } },
            },
          },
          {
            secondaryMuscles: {
              some: { name: { in: filters.muscle } },
            },
          },
        ],
      });
    }

    return this.prisma.exercise.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      include: {
        difficulty: true,
        primaryMuscles: { include: { bodyPart: true } },
        secondaryMuscles: { include: { bodyPart: true } },
        equipmentSlots: {
          include: {
            options: {
              include: {
                subcategory: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async getExercisesAvailableAtGym(gymId: number, search?: string) {
    const equipment = await this.prisma.gymEquipment.findMany({
      where: { gymId },
      include: {
        equipment: {
          select: { subcategoryId: true },
        },
      },
    });

    const subcategoryIds = equipment
      .map((e) => e.equipment.subcategoryId)
      .filter((id): id is number => !!id);

    if (subcategoryIds.length === 0) return [];

    const options = await this.prisma.exerciseEquipmentOption.findMany({
      where: {
        subcategoryId: { in: subcategoryIds },
      },
      select: {
        slot: {
          select: {
            exerciseId: true,
          },
        },
      },
    });

    const exerciseIds = [...new Set(options.map((o) => o.slot.exerciseId))];

    return this.prisma.exercise.findMany({
      where: {
        id: { in: exerciseIds },
        ...(search && {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }),
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }

  async updateExercise(id: number, input: UpdateExerciseInput, userId: number) {
    await this.verifyOwnership(userId, id);
    await validateInput(input, UpdateExerciseDto);

    const {
      primaryMuscleIds,
      secondaryMuscleIds,
      difficultyId,
      exerciseTypeId,
      equipmentSlots,
      ...exerciseData
    } = input;

    const updatedExercise = await this.prisma.exercise.update({
      where: { id },
      data: {
        ...exerciseData,
        difficultyId: difficultyId ?? undefined,
        exerciseTypeId: exerciseTypeId ?? undefined,
        ...(primaryMuscleIds && {
          primaryMuscles: {
            set: primaryMuscleIds.map((id) => ({ id })),
          },
        }),
        ...(secondaryMuscleIds && {
          secondaryMuscles: {
            set: secondaryMuscleIds.map((id) => ({ id })),
          },
        }),
      },
    });

    if (equipmentSlots) {
      const oldSlots = await this.prisma.exerciseEquipmentSlot.findMany({
        where: { exerciseId: id },
        select: { id: true },
      });

      const slotIds = oldSlots.map((s) => s.id);

      // Delete old options and slots
      await this.prisma.exerciseEquipmentOption.deleteMany({
        where: { slotId: { in: slotIds } },
      });

      await this.prisma.exerciseEquipmentSlot.deleteMany({
        where: { exerciseId: id },
      });

      // Recreate new slots and options
      for (const slot of equipmentSlots) {
        const createdSlot = await this.prisma.exerciseEquipmentSlot.create({
          data: {
            slotIndex: slot.slotIndex,
            isRequired: slot.isRequired,
            comment: slot.comment,
            exerciseId: id,
          },
        });

        await this.prisma.exerciseEquipmentOption.createMany({
          data: slot.options.map((opt) => ({
            slotId: createdSlot.id,
            subcategoryId: opt.subcategoryId,
          })),
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
