import {
  CreateWorkoutPlanDto,
  UpdateWorkoutPlanDto,
  CreateWorkoutProgramDto,
  UpdateWorkoutProgramDto,
  CreateWorkoutProgramDayDto,
  UpdateWorkoutProgramDayDto,
  CreateWorkoutProgramCooldownDto,
  CreateWorkoutProgramAssignmentDto,
  SetUserWorkoutPreferencesDto,
  CreateMuscleGroupDto,
  UpdateMuscleGroupDto,
  UpdateTrainingMethodGoalsDto,
  CreateTrainingMethodDto,
  UpdateTrainingMethodDto,
  CreateExperienceLevelDto,
  UpdateExperienceLevelDto,
} from './workoutplan.dto';
import { CreateWorkoutPlanInput, UpdateWorkoutPlanInput } from './workoutplan.types';
import { SharingService } from './workoutplanSharing.service';
import { PrismaClient } from '../../lib/prisma';
import { validateInput } from '../../middlewares/validation';
import { verifyRoles } from '../auth/auth.roles';
import { PermissionService } from '../core/permission.service';

export class WorkoutPlanService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;
  private sharingService: SharingService;

  constructor(
    prisma: PrismaClient,
    permissionService: PermissionService,
    sharingService: SharingService,
  ) {
    this.prisma = prisma;
    this.permissionService = permissionService;
    this.sharingService = sharingService;
  }

  private async verifyWorkoutPlanAccess(userId: number, workoutPlanId: number) {
    const userRoles = await this.permissionService.getUserRoles(userId);

    const workoutPlan = await this.prisma.workoutPlan.findUnique({
      where: { id: workoutPlanId },
      include: { sharedWith: true },
    });

    if (!workoutPlan) throw new Error('Workout not found');

    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, ['ADMIN']);
    const isOwner = workoutPlan.userId === userId;
    const isShared = workoutPlan.sharedWith.some((user) => user.id === userId);

    console.log({
      workoutPlan,
      userId,
      roles: userRoles,
      isAdmin,
      isOwner,
      isShared,
    });

    if (!isAdmin && !isOwner && !isShared) {
      throw new Error('Unauthorized workout access');
    }
  }

  private async createPlanExercises(
    workoutPlanId: number,
    exercises: any[],
    groupMap: Record<number, number> = {},
  ) {
    if (!exercises?.length) return;

    await this.prisma.workoutPlanExercise.createMany({
      data: exercises.map((ex, idx) => ({
        workoutPlanId,
        exerciseId: ex.exerciseId,
        order: ex.order ?? idx,
        targetSets: ex.targetSets ?? null,
        targetMetrics: ex.targetMetrics ?? [],
        trainingMethodId: ex.trainingMethodId ?? null,
        groupId:
          ex.groupId !== undefined && ex.groupId !== null ? (groupMap[ex.groupId] ?? null) : null,
        isWarmup: ex.isWarmup ?? false,
      })),
    });
  }

  private async createPlanGroups(
    workoutPlanId: number,
    groups: any[],
  ): Promise<Record<number, number>> {
    if (!groups?.length) return {};

    const map: Record<number, number> = {};

    for (const [idx, group] of groups.entries()) {
      const created = await this.prisma.workoutPlanGroup.create({
        data: {
          workoutPlanId,
          trainingMethodId: group.trainingMethodId,
          order: group.order ?? idx,
        },
      });
      map[group.id] = created.id;
    }

    return map;
  }

  async createWorkoutPlan(userId: number, data: CreateWorkoutPlanInput) {
    if (!userId) throw new Error('Unauthorized');

    const userRoles = await this.permissionService.getUserRoles(userId);
    const hasPremium = this.permissionService.verifyPremiumAccess(userRoles.userRoles, true);
    if (!hasPremium) throw new Error('Premium subscription required to create workouts');

    await validateInput(data, CreateWorkoutPlanDto);

    let experienceLevelId: number | null = null;
    if (data.intensityPresetId) {
      const preset = await this.prisma.intensityPreset.findUnique({
        where: { id: data.intensityPresetId },
        select: { experienceLevelId: true },
      });
      experienceLevelId = preset?.experienceLevelId || null;
    } else {
      const def = await this.prisma.experienceLevel.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });
      experienceLevelId = def?.id || null;
    }

    const workoutPlan = await this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
        isPublic: data.isPublic ?? false,
        trainingGoalId: data.trainingGoalId ?? null,
        intensityPresetId: data.intensityPresetId ?? null,
        experienceLevelId: experienceLevelId!,
        muscleGroups: data.muscleGroupIds
          ? {
              connect: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    console.log('createWorkoutPlan → userId:', userId);

    const groupMap = await this.createPlanGroups(workoutPlan.id, data.groups || []);
    await this.createPlanExercises(workoutPlan.id, data.exercises || [], groupMap);
    return workoutPlan;
  }

  async createWorkoutPlanVersion(
    userId: number,
    parentPlanId: number,
    data: CreateWorkoutPlanInput,
  ) {
    await this.verifyWorkoutPlanAccess(userId, parentPlanId);
    await validateInput(data, CreateWorkoutPlanDto);

    const parent = await this.prisma.workoutPlan.findUnique({
      where: { id: parentPlanId },
      select: { userId: true },
    });

    if (!parent || parent.userId !== userId) {
      throw new Error('Only the original creator can version this workout');
    }

    const versionCount = await this.prisma.workoutPlan.count({
      where: { parentPlanId },
    });

    let experienceLevelId: number | null = null;
    if (data.intensityPresetId) {
      const preset = await this.prisma.intensityPreset.findUnique({
        where: { id: data.intensityPresetId },
        select: { experienceLevelId: true },
      });
      experienceLevelId = preset?.experienceLevelId || null;
    } else {
      const def = await this.prisma.experienceLevel.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });
      experienceLevelId = def?.id || null;
    }

    const newVersion = await this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? false,
        parentPlanId,
        version: versionCount + 2,
        userId,
        trainingGoalId: data.trainingGoalId ?? null,
        intensityPresetId: data.intensityPresetId ?? null,
        experienceLevelId: experienceLevelId!,
        muscleGroups: data.muscleGroupIds
          ? {
              connect: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    const groupMap = await this.createPlanGroups(newVersion.id, data.groups || []);
    await this.createPlanExercises(newVersion.id, data.exercises || [], groupMap);
    return newVersion;
  }

  async getWorkoutPlans(userId: number) {
    if (!userId) throw new Error('Unauthorized');

    return this.prisma.workoutPlan.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  async getWorkoutPlanById(userId: number, workoutPlanId: number) {
    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);
    const plan = await this.prisma.workoutPlan.findUnique({
      where: { id: workoutPlanId },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublic: true,
        trainingGoalId: true,
        intensityPresetId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!plan) throw new Error('Plan not found');
    return plan;
  }

  async updateWorkoutPlan(userId: number, workoutPlanId: number, data: UpdateWorkoutPlanInput) {
    if (!userId) throw new Error('Unauthorized');

    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);
    await validateInput(data, UpdateWorkoutPlanDto);

    const updated = await this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        trainingGoalId: data.trainingGoalId ?? undefined,
        intensityPresetId: data.intensityPresetId ?? undefined,
        experienceLevelId: data.intensityPresetId
          ? ((
              await this.prisma.intensityPreset.findUnique({
                where: { id: data.intensityPresetId },
                select: { experienceLevelId: true },
              })
            )?.experienceLevelId ?? undefined)
          : undefined,
        muscleGroups: data.muscleGroupIds
          ? {
              set: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    let groupMap: Record<number, number> = {};

    if (data.groups) {
      await this.prisma.workoutPlanGroup.deleteMany({
        where: { workoutPlanId: workoutPlanId },
      });
      groupMap = await this.createPlanGroups(workoutPlanId, data.groups);
    }

    if (data.exercises) {
      await this.prisma.workoutPlanExercise.deleteMany({
        where: { workoutPlanId: workoutPlanId },
      });
      await this.createPlanExercises(workoutPlanId, data.exercises, groupMap);
    }

    // Fetch the updated plan after recreating groups and exercises
    return this.getWorkoutPlanById(userId, workoutPlanId);
  }

  async deleteWorkoutPlan(userId: number, workoutPlanId: number) {
    if (!userId) throw new Error('Unauthorized');

    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);

    await this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: { deletedAt: new Date() },
    });

    return 'Workout plan marked as deleted';
  }

  async shareWorkoutPlan(ownerId: number, workoutPlanId: number, shareWithUserId: number | null) {
    if (!ownerId) throw new Error('Unauthorized');

    await this.verifyWorkoutPlanAccess(ownerId, workoutPlanId);

    if (shareWithUserId) {
      return this.sharingService.shareWorkoutPlan(ownerId, workoutPlanId, shareWithUserId, 'VIEW');
    }

    return this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: { isPublic: true },
    });
  }

  async getSharedWorkoutPlans(userId: number) {
    if (!userId) throw new Error('Unauthorized');

    return this.prisma.workoutPlan.findMany({
      where: {
        sharedWith: {
          some: { id: userId },
        },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async createTrainingGoal(context: any, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    return this.prisma.trainingGoal.create({ data: input });
  }

  async updateTrainingGoal(context: any, id: number, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    return this.prisma.trainingGoal.update({
      where: { id },
      data: input,
    });
  }

  async deleteTrainingGoal(context: any, id: number) {
    verifyRoles(context, { requireAppRole: 'ADMIN' });
    await this.prisma.trainingGoal.delete({ where: { id } });
    return true;
  }

  async createIntensityPreset(context: any, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    const { metricDefaults, ...presetData } = input;
    return this.prisma.intensityPreset.create({
      data: {
        ...presetData,
        metricDefaults: {
          create: metricDefaults.map((m: any) => ({
            metricId: m.metricId,
            defaultMin: m.defaultMin,
            defaultMax: m.defaultMax ?? null,
          })),
        },
      },
      include: { metricDefaults: true },
    });
  }

  async updateIntensityPreset(context: any, id: number, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    const { metricDefaults, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.intensityMetricDefault.deleteMany({ where: { presetId: id } });
      if (metricDefaults?.length) {
        await tx.intensityMetricDefault.createMany({
          data: metricDefaults.map((m: any) => ({
            metricId: m.metricId,
            defaultMin: m.defaultMin,
            defaultMax: m.defaultMax ?? null,
            presetId: id,
          })),
        });
      }
      await tx.intensityPreset.update({ where: { id }, data });
      return tx.intensityPreset.findUnique({
        where: { id },
        include: { metricDefaults: true },
      });
    });
  }

  async deleteIntensityPreset(context: any, id: number) {
    verifyRoles(context, { requireAppRole: 'ADMIN' });
    await this.prisma.intensityPreset.delete({ where: { id } });
    return true;
  }

  async getExperienceLevels() {
    return this.prisma.experienceLevel.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async createExperienceLevel(context: any, input: CreateExperienceLevelDto) {
    verifyRoles(context, { requireAppRole: 'ADMIN' });
    await validateInput(input, CreateExperienceLevelDto);
    return this.prisma.experienceLevel.create({ data: input });
  }

  async updateExperienceLevel(context: any, id: number, input: UpdateExperienceLevelDto) {
    verifyRoles(context, { requireAppRole: 'ADMIN' });
    await validateInput(input, UpdateExperienceLevelDto);
    return this.prisma.experienceLevel.update({ where: { id }, data: input });
  }

  async deleteExperienceLevel(context: any, id: number) {
    verifyRoles(context, { requireAppRole: 'ADMIN' });
    await this.prisma.experienceLevel.delete({ where: { id } });
    return true;
  }

  // 🔒 MuscleGroup
  async createMuscleGroup(context: any, input: CreateMuscleGroupDto) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    return this.prisma.muscleGroup.create({
      data: {
        name: input.name,
        slug: input.slug,
        bodyParts: input.bodyPartIds
          ? {
              connect: input.bodyPartIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        bodyParts: true, // 👈 This is critical
      },
    });
  }

  async updateMuscleGroup(context: any, id: number, input: UpdateMuscleGroupDto) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    return this.prisma.muscleGroup.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        bodyParts: input.bodyPartIds
          ? {
              set: input.bodyPartIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        bodyParts: true, // 👈 This is critical
      },
    });
  }

  async deleteMuscleGroup(context: any, id: number) {
    verifyRoles(context, {
      requireAppRole: 'ADMIN',
    });
    await this.prisma.muscleGroup.delete({ where: { id } });
    return true;
  }

  // 🔒 TrainingMethod
  async createTrainingMethod(context: any, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    await validateInput(input, CreateTrainingMethodDto);

    return this.prisma.trainingMethod.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        minGroupSize: input.minGroupSize ?? null,
        maxGroupSize: input.maxGroupSize ?? null,
        shouldAlternate: input.shouldAlternate ?? false,
      },
    });
  }

  async updateTrainingMethod(context: any, id: number, input: any) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    await validateInput(input, UpdateTrainingMethodDto);

    return this.prisma.trainingMethod.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        minGroupSize: input.minGroupSize,
        maxGroupSize: input.maxGroupSize,
        shouldAlternate: input.shouldAlternate,
      },
    });
  }

  async deleteTrainingMethod(context: any, id: number) {
    verifyRoles(context, {
      requireAppRole: 'ADMIN',
    });
    await this.prisma.trainingMethod.delete({ where: { id } });
    return true;
  }

  // Workout Program CRUD

  async getWorkoutPrograms(userId: number) {
    return this.prisma.workoutProgram.findMany({
      where: { userId },
      include: { days: true, cooldowns: true, assignments: true },
    });
  }

  async getWorkoutProgramById(userId: number, id: number) {
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id },
      include: { days: true, cooldowns: true, assignments: true },
    });
    if (!program || program.userId !== userId) throw new Error('Unauthorized');
    return program;
  }

  async createWorkoutProgram(userId: number, input: any) {
    await validateInput(input, CreateWorkoutProgramDto);
    return this.prisma.workoutProgram.create({
      data: { ...input, userId },
    });
  }

  async updateWorkoutProgram(userId: number, id: number, input: any) {
    await validateInput(input, UpdateWorkoutProgramDto);
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id },
    });
    if (!program || program.userId !== userId) throw new Error('Unauthorized');
    return this.prisma.workoutProgram.update({
      where: { id },
      data: input,
    });
  }

  async deleteWorkoutProgram(userId: number, id: number) {
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id },
    });
    if (!program || program.userId !== userId) throw new Error('Unauthorized');
    await this.prisma.workoutProgram.delete({ where: { id } });
    return true;
  }

  // Program Day

  async createWorkoutProgramDay(userId: number, input: any) {
    await validateInput(input, CreateWorkoutProgramDayDto);
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id: input.programId },
    });
    if (!program || program.userId !== userId) throw new Error('Unauthorized');
    return this.prisma.workoutProgramDay.create({ data: input });
  }

  async updateWorkoutProgramDay(userId: number, id: number, input: any) {
    await validateInput(input, UpdateWorkoutProgramDayDto);
    const day = await this.prisma.workoutProgramDay.findUnique({
      where: { id },
      include: { program: true },
    });
    if (!day || day.program.userId !== userId) throw new Error('Unauthorized');
    return this.prisma.workoutProgramDay.update({ where: { id }, data: input });
  }

  async deleteWorkoutProgramDay(userId: number, id: number) {
    const day = await this.prisma.workoutProgramDay.findUnique({
      where: { id },
      include: { program: true },
    });
    if (!day || day.program.userId !== userId) throw new Error('Unauthorized');
    await this.prisma.workoutProgramDay.delete({ where: { id } });
    return true;
  }

  // Muscle Cooldowns

  async createWorkoutProgramCooldown(userId: number, input: any) {
    await validateInput(input, CreateWorkoutProgramCooldownDto);
    const program = await this.prisma.workoutProgram.findUnique({
      where: { id: input.programId },
    });
    if (!program || program.userId !== userId) throw new Error('Unauthorized');
    return this.prisma.workoutProgramMuscleCooldown.create({ data: input });
  }

  async deleteWorkoutProgramCooldown(userId: number, id: number) {
    const cooldown = await this.prisma.workoutProgramMuscleCooldown.findUnique({
      where: { id },
      include: { program: true },
    });
    if (!cooldown || cooldown.program.userId !== userId) throw new Error('Unauthorized');
    await this.prisma.workoutProgramMuscleCooldown.delete({ where: { id } });
    return true;
  }

  // Assignments

  async createWorkoutProgramAssignment(userId: number, input: any) {
    await validateInput(input, CreateWorkoutProgramAssignmentDto);
    const day = await this.prisma.workoutProgramDay.findUnique({
      where: { id: input.programDayId },
      include: { program: true },
    });
    if (!day || day.program.userId !== userId) throw new Error('Unauthorized');
    return this.prisma.workoutProgramAssignment.create({ data: input });
  }

  async deleteWorkoutProgramAssignment(userId: number, id: number) {
    const assignment = await this.prisma.workoutProgramAssignment.findUnique({
      where: { id },
      include: { programDay: { include: { program: true } } },
    });
    if (!assignment || assignment.programDay.program.userId !== userId)
      throw new Error('Unauthorized');
    await this.prisma.workoutProgramAssignment.delete({ where: { id } });
    return true;
  }

  // User Preferences

  async setUserWorkoutPreferences(userId: number, input: any) {
    await validateInput(input, SetUserWorkoutPreferencesDto);
    return this.prisma.userWorkoutPreferences.upsert({
      where: { userId },
      update: input,
      create: { ...input, userId },
    });
  }

  async getUserWorkoutPreferences(userId: number) {
    return this.prisma.userWorkoutPreferences.findUnique({
      where: { userId },
    });
  }

  async shareWorkoutProgram(ownerId: number, programId: number, shareWithUserId: number | null) {
    if (!ownerId) throw new Error('Unauthorized');

    const program = await this.prisma.workoutProgram.findUnique({
      where: { id: programId },
    });
    if (!program || program.userId !== ownerId) throw new Error('Unauthorized program access');

    if (shareWithUserId) {
      return this.sharingService.shareWorkoutProgram(ownerId, programId, shareWithUserId, 'VIEW');
    }

    return this.prisma.workoutProgram.update({
      where: { id: programId },
      data: {
        /* optionally expose isPublic: true if you support it */
      },
    });
  }

  async updateTrainingMethodGoals(context: any, input: UpdateTrainingMethodGoalsDto) {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    await validateInput(input, UpdateTrainingMethodGoalsDto);

    const updated = await this.prisma.trainingMethod.update({
      where: { id: input.methodId },
      data: {
        trainingGoals: {
          set: input.goalIds.map((id) => ({ id })),
        },
      },
      include: {
        trainingGoals: true,
      },
    });

    return updated;
  }
}
