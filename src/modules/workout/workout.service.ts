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

    return this.prisma.workoutPlan.create({
      data: {
        name: data.name,
        description: data.description,
        userId,
      },
    });
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

  async updateWorkout(
    userId: number,
    workoutId: number,
    data: UpdateWorkoutInput
  ) {
    if (!userId) throw new Error("Unauthorized");

    await this.verifyWorkoutAccess(userId, workoutId);
    await validateInput(data, UpdateWorkoutDto);

    return this.prisma.workoutPlan.update({
      where: { id: workoutId },
      data,
    });
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
