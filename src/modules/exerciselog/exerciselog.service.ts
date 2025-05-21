import { PrismaClient } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import {
  CreateExerciseLogInput,
  UpdateExerciseLogInput,
  CreateWorkoutSessionInput,
  UpdateWorkoutSessionInput,
  WorkoutSession,
} from "./exerciselog.types";
import { validateInput } from "../../middlewares/validation";
import {
  CreateExerciseLogDto,
  UpdateExerciseLogDto,
  CreateWorkoutSessionDto,
  UpdateWorkoutSessionDto,
} from "./exerciselog.dto";

export class ExerciseLogService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  async getExerciseLogs(userId: number) {
    const roles = await this.permissionService.getUserRoles(userId);

    if (this.permissionService.verifyAppRoles(roles.appRoles, ["ADMIN"])) {
      return this.prisma.exerciseLog.findMany();
    }

    // fallback to session-based ownership filtering
    return this.prisma.exerciseLog.findMany({
      where: {
        workoutSession: {
          userId: userId,
        },
      },
      include: {
        workoutSession: true,
      },
    });
  }

  async createExerciseLog(data: CreateExerciseLogInput, userId: number) {
    await validateInput(data, CreateExerciseLogDto);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userRole: true },
    });

    if (
      !user ||
      !["PREMIUM_USER", "PERSONAL_TRAINER", "ADMIN"].includes(user.userRole)
    ) {
      throw new Error("Upgrade to premium to create exercise logs");
    }

    return this.prisma.exerciseLog.create({
      data: {
        exerciseId: data.exerciseId,
        gymEquipmentId: data.gymEquipmentId,
        workoutSessionId: data.workoutSessionId,
        setNumber: data.setNumber,
        reps: data.reps,
        weight: data.weight,
        rpe: data.rpe ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  async updateExerciseLog(
    id: number,
    data: UpdateExerciseLogInput,
    userId: number
  ) {
    // Optional: Add ownership validation based on workoutSession.userId if desired
    await validateInput(data, UpdateExerciseLogDto);

    return this.prisma.exerciseLog.update({
      where: { id },
      data,
    });
  }

  async deleteExerciseLog(id: number, userId: number) {
    // Optional: Add ownership validation if necessary
    await this.prisma.exerciseLog.delete({
      where: { id },
    });

    return true;
  }

  async createWorkoutSession(input: CreateWorkoutSessionInput, userId: number) {
    await validateInput(input, CreateWorkoutSessionDto);

    if (input.userId !== userId) {
      throw new Error(
        "You are not authorized to create a session for another user"
      );
    }

    const existing = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        endedAt: null,
      },
    });

    if (existing) {
      throw new Error("You already have an active workout session.");
    }

    return this.prisma.workoutSession.create({
      data: {
        userId: input.userId,
        gymId: input.gymId, // ✅ REQUIRED now
        startedAt: new Date(input.startedAt),
        workoutPlanId: input.workoutPlanId ?? null,
        assignedWorkoutId: input.assignedWorkoutId ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async updateWorkoutSession(
    id: number,
    input: UpdateWorkoutSessionInput,
    userId: number
  ) {
    await validateInput(input, UpdateWorkoutSessionDto); // Uncomment when DTO is available

    const session = await this.prisma.workoutSession.findUnique({
      where: { id },
    });

    if (!session) throw new Error("WorkoutSession not found");
    if (session.userId !== userId) throw new Error("Unauthorized");

    return this.prisma.workoutSession.update({
      where: { id },
      data: {
        endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
        notes: input.notes ?? undefined,
      },
    });
  }

  async deleteWorkoutSession(id: number, userId: number): Promise<boolean> {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) throw new Error("Unauthorized");

    await this.prisma.exerciseLog.deleteMany({
      where: { workoutSessionId: id },
    });

    await this.prisma.workoutSession.delete({
      where: { id },
    });

    return true;
  }

  async getActiveWorkoutSession(userId: number) {
    return this.prisma.workoutSession.findFirst({
      where: {
        userId,
        endedAt: null,
      },
    });
  }
}
