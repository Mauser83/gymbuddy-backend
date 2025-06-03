import { PrismaClient } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import { AuthContext } from "../auth/auth.types";
import { verifyRoles } from "../auth/auth.roles";
import { AppRole, UserRole } from "../../lib/prisma";
import { validateInput } from "../../middlewares/validation";
import {
  UpdateUserRolesDto,
  UpdateUserTrainingPreferencesDto,
} from "./user.dto";

export class UserService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.permissionService = new PermissionService(prisma);
  }

  async searchUsers(context: AuthContext, search?: string) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    if (search) {
      return this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      });
    }

    return this.prisma.user.findMany();
  }

  async getUserById(context: AuthContext, id: number) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.user.findUnique({
      where: { id },
      include: {
        gymManagementRoles: {
          include: { gym: true },
        },
      },
    });
  }

  async deleteUser(context: AuthContext, id: number) {
    verifyRoles(context, { requireAppRole: "ADMIN" });

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateUserRoles(
    context: AuthContext,
    args: { userId: number; appRole?: string; userRole: string }
  ) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    await validateInput(args, UpdateUserRolesDto);

    const dataToUpdate: any = {
      userRole: args.userRole as UserRole,
      tokenVersion: { increment: 1 }, // force token invalidation
    };

    if (context.appRole === "ADMIN") {
      dataToUpdate.appRole =
        args.appRole && args.appRole !== "NONE"
          ? (args.appRole as AppRole)
          : null;
    }

    return this.prisma.user.update({
      where: { id: args.userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        username: true,
        appRole: true,
        userRole: true,
      },
    });
  }

  async updateTrainingPreferences(
    userId: number,
    input: UpdateUserTrainingPreferencesDto
  ) {
    await validateInput(input, UpdateUserTrainingPreferencesDto);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        trainingGoalId: input.trainingGoalId ?? undefined,
        experienceLevel: input.experienceLevel ?? undefined,
      },
      include: {
        trainingGoal: true,
      },
    });
  }
}
