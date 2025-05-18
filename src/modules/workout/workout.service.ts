import { PrismaClient } from "../../lib/prisma";
import { CreateWorkoutInput, UpdateWorkoutInput } from "./workout.types";
import { PermissionService } from "../core/permission.service";
import { SharingService } from "./workoutSharing.service";
import { validateInput } from "../../middlewares/validation";
import { CreateWorkoutDto, UpdateWorkoutDto } from "./workout.dto";

export class WorkoutService {
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

  private async verifyWorkoutAccess(userId: number, workoutId: number) {
    const userRoles = await this.permissionService.getUserRoles(userId);

    const workout = await this.prisma.workoutPlan.findUnique({
      where: { id: workoutId },
      include: { sharedWith: true },
    });

    if (!workout) throw new Error("Workout not found");

    const isAdmin = this.permissionService.verifyAppRoles(userRoles.appRoles, [
      "ADMIN",
    ]);
    const isOwner = workout.userId === userId;
    const isShared = workout.sharedWith.some((user) => user.id === userId);

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
      })),
    });
  }

  async createWorkout(userId: number, data: CreateWorkoutInput) {
    if (!userId) throw new Error("Unauthorized");

    const userRoles = await this.permissionService.getUserRoles(userId);
    const hasPremium = this.permissionService.verifyPremiumAccess(
      userRoles.userRoles,
      true
    );
    if (!hasPremium)
      throw new Error("Premium subscription required to create workouts");

    await validateInput(data, CreateWorkoutDto);

    const workout = await this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
        isPublic: data.isPublic ?? false,
      },
    });

    await this.createPlanExercises(workout.id, data.exercises || []);
    return workout;
  }

  async createWorkoutVersion(userId: number, parentPlanId: number, data: CreateWorkoutInput) {
    await this.verifyWorkoutAccess(userId, parentPlanId);
    await validateInput(data, CreateWorkoutDto);

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
      },
    });

    await this.createPlanExercises(newVersion.id, data.exercises || []);
    return newVersion;
  }

  async getWorkouts(userId: number) {
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

  async getWorkoutById(userId: number, workoutId: number) {
    await this.verifyWorkoutAccess(userId, workoutId);
    return this.prisma.workoutPlan.findUnique({ where: { id: workoutId } });
  }

  async updateWorkout(
    userId: number,
    workoutId: number,
    data: UpdateWorkoutInput
  ) {
    if (!userId) throw new Error("Unauthorized");

    await this.verifyWorkoutAccess(userId, workoutId);
    await validateInput(data, UpdateWorkoutDto);

    const updated = await this.prisma.workoutPlan.update({
      where: { id: workoutId },
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
      },
    });

    if (data.exercises) {
      await this.prisma.workoutPlanExercise.deleteMany({
        where: { workoutPlanId: workoutId },
      });
      await this.createPlanExercises(workoutId, data.exercises);
    }

    return updated;
  }

  async deleteWorkout(userId: number, workoutId: number) {
    if (!userId) throw new Error("Unauthorized");

    await this.verifyWorkoutAccess(userId, workoutId);

    await this.prisma.workoutPlan.update({
      where: { id: workoutId },
      data: { deletedAt: new Date() },
    });

    return "Workout marked as deleted";
  }

  async shareWorkout(
    ownerId: number,
    workoutId: number,
    shareWithUserId: number | null
  ) {
    if (!ownerId) throw new Error("Unauthorized");

    await this.verifyWorkoutAccess(ownerId, workoutId);

    if (shareWithUserId) {
      return this.sharingService.shareWorkout(
        ownerId,
        workoutId,
        shareWithUserId,
        "VIEW"
      );
    }

    return this.prisma.workoutPlan.update({
      where: { id: workoutId },
      data: { isPublic: true },
    });
  }
}
