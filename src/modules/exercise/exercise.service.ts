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
  CreateMetricDto,
  UpdateMetricDto,
  CreateExerciseSuggestionDto,
  ApproveExerciseSuggestionDto,
  RejectExerciseSuggestionDto,
  ListExerciseSuggestionsDto,
  type CreateExerciseSuggestionInput,
  type CreateExerciseSuggestionPayload,
  type ApproveExerciseSuggestionInput,
  type ApproveExerciseSuggestionPayload,
  type RejectExerciseSuggestionInput,
  type RejectExerciseSuggestionPayload,
  type ListExerciseSuggestionsInput,
  type ListExerciseSuggestionsPayload,
} from './exercise.dto';
import {
  ExerciseQueryFilters,
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
  CreateMetricInput,
  UpdateMetricInput,
  type CreateExerciseSlotInput,
  type ExerciseSuggestion,
} from './exercise.types';
import { validateInput } from '../../middlewares/validation';
import { PrismaClient, Prisma } from '../../prisma';
import { verifyRoles } from '../auth/auth.roles';
import { AuthContext } from '../auth/auth.types';
import { PermissionService } from '../core/permission.service';

export class ExerciseService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  private validateSuggestionEquipmentSlots(slots: CreateExerciseSlotInput[]) {
    if (slots.length > 5) {
      throw new Error('A maximum of 5 equipment slots is allowed');
    }

    const seen = new Set<number>();
    for (const slot of slots) {
      if (!slot.options.length) {
        throw new Error('Each equipment slot must include at least one option');
      }

      for (const option of slot.options) {
        if (seen.has(option.subcategoryId)) {
          throw new Error('Duplicate equipment subcategory in suggestion');
        }
        seen.add(option.subcategoryId);
      }
    }
  }

  // ---------- EXERCISE CORE ----------

  private async verifyOwnership(userId: number, exerciseId: number) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { userId: true },
    });

    if (!exercise || exercise.userId !== userId) {
      throw new Error('Unauthorized exercise access');
    }
  }

  async createExercise(context: AuthContext, input: CreateExerciseInput, userId: number) {
    await validateInput(input, CreateExerciseDto);

    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

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
        difficultyId: difficultyId as number,
        exerciseTypeId: exerciseTypeId as number,
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

  // ---------- EXERCISE SUGGESTIONS ----------

  async createExerciseSuggestion(
    managerUserId: number,
    input: CreateExerciseSuggestionInput,
  ): Promise<CreateExerciseSuggestionPayload> {
    await validateInput(input, CreateExerciseSuggestionDto);

    const slots = input.exercise.equipmentSlots as unknown as CreateExerciseSlotInput[];
    this.validateSuggestionEquipmentSlots(slots);

    const suggestion = await this.prisma.exerciseSuggestion.create({
      data: {
        managerUserId,
        gymId: input.gymId ?? null,
        name: input.exercise.name,
        description: input.exercise.description ?? null,
        videoUrl: input.exercise.videoUrl ?? null,
        difficultyId: input.exercise.difficultyId,
        exerciseTypeId: input.exercise.exerciseTypeId,
        primaryMuscleIds: input.exercise.primaryMuscleIds,
        secondaryMuscleIds: input.exercise.secondaryMuscleIds ?? [],
        equipmentSlots: slots as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    });

    return suggestion;
  }

  async approveExerciseSuggestion(
    context: AuthContext,
    input: ApproveExerciseSuggestionInput,
  ): Promise<ApproveExerciseSuggestionPayload> {
    await validateInput(input, ApproveExerciseSuggestionDto);

    const suggestion = await this.prisma.exerciseSuggestion.findUnique({
      where: { id: input.id },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not pending');
    }

    const equipmentSlots =
      suggestion.equipmentSlots as Prisma.JsonValue as unknown as CreateExerciseSlotInput[];
    this.validateSuggestionEquipmentSlots(equipmentSlots);

    const createdExercise = await this.createExercise(
      context,
      {
        name: suggestion.name,
        description: suggestion.description ?? undefined,
        videoUrl: suggestion.videoUrl ?? undefined,
        difficultyId: suggestion.difficultyId,
        exerciseTypeId: suggestion.exerciseTypeId,
        primaryMuscleIds: suggestion.primaryMuscleIds,
        secondaryMuscleIds: suggestion.secondaryMuscleIds ?? [],
        equipmentSlots,
      },
      suggestion.managerUserId,
    );

    await this.prisma.exerciseSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'APPROVED',
        approvedExerciseId: createdExercise.id,
        rejectedReason: null,
      },
    });

    return { approved: true, exerciseId: createdExercise.id };
  }

  async rejectExerciseSuggestion(
    input: RejectExerciseSuggestionInput,
  ): Promise<RejectExerciseSuggestionPayload> {
    await validateInput(input, RejectExerciseSuggestionDto);

    const suggestion = await this.prisma.exerciseSuggestion.findUnique({
      where: { id: input.id },
      select: { status: true },
    });

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not pending');
    }

    const reason = input.reason?.trim();

    await this.prisma.exerciseSuggestion.update({
      where: { id: input.id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason && reason.length > 0 ? reason : 'Rejected',
        approvedExerciseId: null,
      },
    });

    return { rejected: true };
  }

  async listExerciseSuggestions(
    input: ListExerciseSuggestionsInput,
  ): Promise<ListExerciseSuggestionsPayload> {
    await validateInput(input, ListExerciseSuggestionsDto);

    const take = Math.min(input.limit ?? 25, 50);

    const rows = await this.prisma.exerciseSuggestion.findMany({
      where: { status: input.status },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
    });

    const sliced = rows.slice(0, take);
    const items = sliced.map((row) => {
      const equipmentSlots =
        row.equipmentSlots as Prisma.JsonValue as unknown as ExerciseSuggestion['equipmentSlots'];
      return {
        ...row,
        equipmentSlots,
        secondaryMuscleIds: row.secondaryMuscleIds ?? [],
      } as ExerciseSuggestion;
    });

    const nextCursor = rows.length > take && items.length > 0 ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async getExercises(search?: string, filters?: ExerciseQueryFilters) {
    const whereClause: any = {
      deletedAt: null,
      AND: [],
    };

    // Add full-text-like search
    if (search) {
      const orClause: any[] = [{ name: { contains: search, mode: 'insensitive' as const } }];

      if (!filters?.difficulty?.length) {
        orClause.push({
          difficulty: {
            level: { contains: search, mode: 'insensitive' as const },
          },
        });
      }

      if (!filters?.exerciseType?.length) {
        orClause.push({
          exerciseType: {
            name: { contains: search, mode: 'insensitive' as const },
          },
        });
      }

      if (!filters?.muscle?.length) {
        orClause.push(
          {
            primaryMuscles: {
              some: {
                name: { contains: search, mode: 'insensitive' as const },
              },
            },
          },
          {
            secondaryMuscles: {
              some: {
                name: { contains: search, mode: 'insensitive' as const },
              },
            },
          },
        );
      }

      if (!filters?.bodyPart?.length) {
        orClause.push(
          {
            primaryMuscles: {
              some: {
                bodyPart: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            },
          },
          {
            secondaryMuscles: {
              some: {
                bodyPart: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            },
          },
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
      orderBy: { name: 'asc' },
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

  async getExerciseById(id: number) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        difficulty: true,
        exerciseType: true,
        primaryMuscles: {
          include: {
            bodyPart: true,
          },
        },
        secondaryMuscles: {
          include: {
            bodyPart: true,
          },
        },
        equipmentSlots: {
          orderBy: { slotIndex: 'asc' },
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

    if (!exercise) return null;

    return exercise;
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
            mode: 'insensitive',
          },
        }),
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
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

    const { name, metrics } = input;

    const created = await this.prisma.exerciseType.create({
      data: {
        name,
      },
    });

    // Insert ordered metric relations
    await this.prisma.exerciseTypeMetric.createMany({
      data: metrics.map((m) => ({
        exerciseTypeId: created.id,
        metricId: m.metricId,
        order: m.order,
      })),
    });

    return created;
  }

  async updateExerciseType(id: number, input: UpdateExerciseTypeInput) {
    await validateInput(input, UpdateExerciseTypeDto);

    const { name, metrics } = input;

    // Update the base type name
    const updated = await this.prisma.exerciseType.update({
      where: { id },
      data: { name },
    });

    // Clear old metrics
    await this.prisma.exerciseTypeMetric.deleteMany({
      where: { exerciseTypeId: id },
    });

    // Insert new metrics
    await this.prisma.exerciseTypeMetric.createMany({
      data: metrics.map((m) => ({
        exerciseTypeId: id,
        metricId: m.metricId,
        order: m.order,
      })),
    });

    return updated;
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

  async updateExerciseDifficulty(id: number, input: UpdateExerciseDifficultyInput) {
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

  // ---------- METRIC ----------

  async createMetric(input: CreateMetricInput) {
    await validateInput(input, CreateMetricDto);
    return this.prisma.metric.create({ data: input });
  }

  async updateMetric(id: number, input: UpdateMetricInput) {
    await validateInput(input, UpdateMetricDto);
    return this.prisma.metric.update({
      where: { id },
      data: input,
    });
  }

  async deleteMetric(id: number) {
    await this.prisma.metric.delete({ where: { id } });
    return true;
  }
}
