import { PrismaClient } from "../../lib/prisma";
import {
  CreateWorkoutPlanInput,
  UpdateWorkoutPlanInput,
} from "./workoutplan.types";
import { PermissionService } from "../core/permission.service";
import { SharingService } from "./workoutplanSharing.service";
import { validateInput } from "../../middlewares/validation";
import { CreateWorkoutPlanDto, UpdateWorkoutPlanDto } from "./workoutplan.dto";
import { verifyRoles } from "../auth/auth.roles";

export class WorkoutPlanService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;
  private sharingService: SharingService;

  constructor(
    prisma: PrismaClient,
    permissionService: PermissionService,
    sharingService: SharingService
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

    if (!workoutPlan) throw new Error("Workout not found");

    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, [
      "ADMIN",
    ]);
    const isOwner = workoutPlan.userId === userId;
    const isShared = workoutPlan.sharedWith.some((user) => user.id === userId);

    if (!isAdmin && !isOwner && !isShared) {
      throw new Error("Unauthorized workout access");
    }
  }

  private async createPlanExercises(workoutPlanId: number, exercises: any[]) {
    if (!exercises?.length) return;

    await this.prisma.workoutPlanExercise.createMany({
      data: exercises.map((ex, idx) => ({
        workoutPlanId,
        exerciseId: ex.exerciseId,
        order: ex.order ?? idx,
        targetSets: ex.targetSets ?? null,
        targetReps: ex.targetReps ?? null,
        targetWeight: ex.targetWeight ?? null,
        targetRpe: ex.targetRpe ?? null,
        trainingMethodId: ex.trainingMethodId ?? null,
        isWarmup: ex.isWarmup ?? false,
      })),
    });
  }

  async createWorkoutPlan(userId: number, data: CreateWorkoutPlanInput) {
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await this.permissionService.getUserRoles(userId);
    const hasPremium = this.permissionService.verifyPremiumAccess(
      userRoles.userRoles,
      true
    );
    if (!hasPremium)
      throw new Error("Premium subscription required to create workouts");

    await validateInput(data, CreateWorkoutPlanDto);

    const workoutPlan = await this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
        isPublic: data.isPublic ?? false,
        workoutTypeId: data.workoutTypeId ?? null,
        muscleGroups: data.muscleGroupIds
          ? {
              connect: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    await this.createPlanExercises(workoutPlan.id, data.exercises || []);
    return workoutPlan;
  }

  async createWorkoutPlanVersion(
    userId: number,
    parentPlanId: number,
    data: CreateWorkoutPlanInput
  ) {
    await this.verifyWorkoutPlanAccess(userId, parentPlanId);
    await validateInput(data, CreateWorkoutPlanDto);

    const parent = await this.prisma.workoutPlan.findUnique({
      where: { id: parentPlanId },
      select: { userId: true },
    });

    if (!parent || parent.userId !== userId) {
      throw new Error("Only the original creator can version this workout");
    }

    const versionCount = await this.prisma.workoutPlan.count({
      where: { parentPlanId },
    });

    const newVersion = await this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? false,
        parentPlanId,
        version: versionCount + 2,
        userId,
        workoutTypeId: data.workoutTypeId ?? null,
        muscleGroups: data.muscleGroupIds
          ? {
              connect: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    await this.createPlanExercises(newVersion.id, data.exercises || []);
    return newVersion;
  }

  async getWorkoutPlans(userId: number) {
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await this.permissionService.getUserRoles(userId);

    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, [
      "ADMIN",
    ]);
    if (isAdmin) {
      return this.prisma.workoutPlan.findMany();
    }

    return this.prisma.workoutPlan.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  async getWorkoutPlanById(userId: number, workoutPlanId: number) {
    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);
    return this.prisma.workoutPlan.findUnique({ where: { id: workoutPlanId } });
  }

  async updateWorkoutPlan(
    userId: number,
    workoutPlanId: number,
    data: UpdateWorkoutPlanInput
  ) {
    if (!userId) throw new Error("Unauthorized");

    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);
    await validateInput(data, UpdateWorkoutPlanDto);

    const updated = await this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        workoutTypeId: data.workoutTypeId ?? undefined,
        muscleGroups: data.muscleGroupIds
          ? {
              set: data.muscleGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    if (data.exercises) {
      await this.prisma.workoutPlanExercise.deleteMany({
        where: { workoutPlanId: workoutPlanId },
      });
      await this.createPlanExercises(workoutPlanId, data.exercises);
    }

    return updated;
  }

  async deleteWorkoutPlan(userId: number, workoutPlanId: number) {
    if (!userId) throw new Error("Unauthorized");

    await this.verifyWorkoutPlanAccess(userId, workoutPlanId);

    await this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: { deletedAt: new Date() },
    });

    return "Workout plan marked as deleted";
  }

  async shareWorkoutPlan(
    ownerId: number,
    workoutPlanId: number,
    shareWithUserId: number | null
  ) {
    if (!ownerId) throw new Error("Unauthorized");

    await this.verifyWorkoutPlanAccess(ownerId, workoutPlanId);

    if (shareWithUserId) {
      return this.sharingService.shareWorkoutPlan(
        ownerId,
        workoutPlanId,
        shareWithUserId,
        "VIEW"
      );
    }

    return this.prisma.workoutPlan.update({
      where: { id: workoutPlanId },
      data: { isPublic: true },
    });
  }

  async getSharedWorkoutPlans(userId: number) {
    if (!userId) throw new Error("Unauthorized");

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

  // 🔒 WorkoutCategory
async createWorkoutCategory(context: any, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.workoutCategory.create({ data: input });
}

async updateWorkoutCategory(context: any, id: number, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.workoutCategory.update({ where: { id }, data: input });
}

async deleteWorkoutCategory(context: any, id: number) {
  verifyRoles(context, {
    requireAppRole: "ADMIN",
  });
  await this.prisma.workoutCategory.delete({ where: { id } });
  return true;
}

// 🔒 WorkoutType
async createWorkoutType(context: any, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.workoutType.create({ data: input });
}

async updateWorkoutType(context: any, id: number, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.workoutType.update({ where: { id }, data: input });
}

async deleteWorkoutType(context: any, id: number) {
  verifyRoles(context, {
    requireAppRole: "ADMIN",
  });
  await this.prisma.workoutType.delete({ where: { id } });
  return true;
}

// 🔒 MuscleGroup
async createMuscleGroup(context: any, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.muscleGroup.create({ data: input });
}

async updateMuscleGroup(context: any, id: number, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.muscleGroup.update({ where: { id }, data: input });
}

async deleteMuscleGroup(context: any, id: number) {
  verifyRoles(context, {
    requireAppRole: "ADMIN",
  });
  await this.prisma.muscleGroup.delete({ where: { id } });
  return true;
}

// 🔒 TrainingMethod
async createTrainingMethod(context: any, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.trainingMethod.create({ data: input });
}

async updateTrainingMethod(context: any, id: number, input: any) {
  verifyRoles(context, {
    or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
  });
  return this.prisma.trainingMethod.update({ where: { id }, data: input });
}

async deleteTrainingMethod(context: any, id: number) {
  verifyRoles(context, {
    requireAppRole: "ADMIN",
  });
  await this.prisma.trainingMethod.delete({ where: { id } });
  return true;
}
}
