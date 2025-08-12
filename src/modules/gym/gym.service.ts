import { PrismaClient } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import { CreateGymInput, UpdateGymInput } from "./gym.types";
import { PermissionType } from "../auth/auth.types";
import {
  CreateGymDto,
  AssignEquipmentToGymDto,
  UpdateGymDto,
  UploadGymEquipmentImageDto,
  UpdateGymEquipmentDto,
} from "./gym.dto";
import { validateInput } from "../../middlewares/validation";
import { pubsub } from "../../graphql/rootResolvers";

const fullGymInclude = {
  creator: true,
  gymRoles: { include: { user: true } },
  gymEquipment: { include: { equipment: true, images: true } },
  trainers: { include: { user: true } },
};

export class GymService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  private async checkGymPermission(
    userId: number,
    gymId: number,
    requiredRoles?: ("GYM_ADMIN" | "GYM_MODERATOR")[]
  ) {
    const userRoles = await this.permissionService.getUserRoles(userId);
    return this.permissionService.checkPermission({
      permissionType: PermissionType.GYM_SCOPE,
      userId: userId,
      userRoles,
      resource: { gymId: gymId },
      requiredRoles: {
        gymRoles: requiredRoles || ["GYM_ADMIN", "GYM_MODERATOR"],
      },
    });
  }

  async createGym(userId: number, data: CreateGymInput) {
    try {
      await validateInput(data, CreateGymDto);

      const newGym = await this.prisma.gym.create({
        data: {
          ...data,
          isApproved: false,
          creatorId: userId,
        },
      });

      const existing = await this.prisma.gymManagementRole.findFirst({
        where: {
          gymId: newGym.id,
          userId,
          role: "GYM_ADMIN",
        },
      });

      if (!existing) {
        await this.prisma.gymManagementRole.create({
          data: {
            gymId: newGym.id,
            userId,
            role: "GYM_ADMIN",
          },
        });
      }

      const gymWithRelations = await this.prisma.gym.findUnique({
        where: { id: newGym.id },
        include: fullGymInclude,
      });

      pubsub.publish("GYM_CREATED", { gymCreated: gymWithRelations });

      return gymWithRelations;
    } catch (err) {
      console.error("❌ createGym crashed", err);
      throw err;
    }
  }

  async getGyms(userId?: number, search?: string) {
    if (!userId) {
      throw new Error("Unauthorized");
    }
    const whereClause: any = { isApproved: true };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { country: { contains: search, mode: "insensitive" } },
      ];
    }

    return this.prisma.gym.findMany({ where: whereClause });
  }

  async getGymById(gymId: number, userId: number, appRole?: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        gymRoles: {
          where: { userId },
        },
      },
    });

    if (!gym) throw new Error("Gym not found");

    const isAppAdmin = appRole === "ADMIN" || appRole === "MODERATOR";

    if (!gym.isApproved && !isAppAdmin) {
      const isGymAdmin = gym.gymRoles.some((r) => r.role === "GYM_ADMIN");
      if (!isGymAdmin) {
        throw new Error("Unauthorized");
      }
    }

    return gym;
  }

  async getPendingGyms(userId: number) {
    const roles = await this.permissionService.getUserRoles(userId);
    const isAllowed = this.permissionService.verifyAppRoles(roles.appRoles, [
      "ADMIN",
      "MODERATOR",
    ]);
    if (!isAllowed) throw new Error("Forbidden");

    return this.prisma.gym.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      include: { creator: true },
    });
  }

  async approveGym(userId: number, gymId: number) {
    const roles = await this.permissionService.getUserRoles(userId);
    const isAllowed = this.permissionService.verifyAppRoles(roles.appRoles, [
      "ADMIN",
      "MODERATOR",
    ]);
    if (!isAllowed) throw new Error("Forbidden");

    const gym = await this.prisma.gym.update({
      where: { id: gymId },
      data: { isApproved: true },
    });

    const updated = await this.prisma.gym.findUnique({
      where: { id: gym.id },
      include: fullGymInclude,
    });

    pubsub.publish("GYM_APPROVED", { gymApproved: updated });
    return "Gym approved successfully";
  }

  async updateGym(
    userId: number,
    gymId: number,
    data: UpdateGymInput,
    appRole?: string
  ) {
    if (appRole !== "ADMIN") {
      const hasAccess = await this.checkGymPermission(userId, gymId, [
        "GYM_ADMIN",
      ]);
      if (!hasAccess) throw new Error("Insufficient gym permissions");
    }

    return this.prisma.gym.update({
      where: { id: gymId },
      data,
    });
  }

  async deleteGym(userId: number, gymId: number, appRole?: string) {
    if (appRole !== "ADMIN") {
      const hasAccess = await this.checkGymPermission(userId, gymId, [
        "GYM_ADMIN",
      ]);
      if (!hasAccess) throw new Error("Unauthorized");
    }

    await this.prisma.gym.delete({ where: { id: gymId } });
    return "Gym deleted successfully";
  }

  async addTrainer(requesterId: number, gymId: number, targetUserId: number) {
    const hasAccess = await this.checkGymPermission(requesterId, gymId, [
      "GYM_ADMIN",
    ]);
    if (!hasAccess) throw new Error("Unauthorized");

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { userRole: true },
    });

    if (user?.userRole !== "PERSONAL_TRAINER") {
      throw new Error("Target user must be a personal trainer");
    }

    await this.prisma.gymTrainer.create({
      data: { userId: targetUserId, gymId },
    });

    return "Trainer added successfully";
  }

  async removeTrainer(
    requesterId: number,
    gymId: number,
    targetUserId: number
  ) {
    if (requesterId !== targetUserId) {
      const hasAccess = await this.checkGymPermission(requesterId, gymId, [
        "GYM_ADMIN",
      ]);
      if (!hasAccess) throw new Error("Unauthorized");
    }

    await this.prisma.gymTrainer.delete({
      where: {
        userId_gymId: {
          userId: targetUserId,
          gymId,
        },
      },
    });

    return "Trainer removed successfully";
  }

  async assignEquipmentToGym(input: AssignEquipmentToGymDto) {
    await validateInput(input, AssignEquipmentToGymDto);

    const exists = await this.prisma.gymEquipment.findFirst({
      where: {
        gymId: input.gymId,
        equipmentId: input.equipmentId,
      },
    });

    if (exists) {
      throw new Error("This equipment is already assigned to this gym");
    }

    return this.prisma.gymEquipment.create({
      data: {
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        quantity: input.quantity,
        note: input.note,
      },
      include: { equipment: true, images: true },
    });
  }

  async updateGymEquipment(input: UpdateGymEquipmentDto) {
    await validateInput(input, UpdateGymEquipmentDto);

    return this.prisma.gymEquipment.update({
      where: { id: input.gymEquipmentId },
      data: {
        quantity: input.quantity,
        note: input.note,
      },
      include: { equipment: true, images: true },
    });
  }

  async removeGymEquipment(gymEquipmentId: number) {
    await this.prisma.gymEquipmentImage.deleteMany({
      where: { gymEquipmentId },
    });

    await this.prisma.gymEquipment.delete({
      where: { id: gymEquipmentId },
    });

    return true;
  }

  async uploadGymEquipmentImage(input: UploadGymEquipmentImageDto) {
    await validateInput(input, UploadGymEquipmentImageDto);

    return this.prisma.gymEquipmentImage.create({
      data: {
        gymEquipmentId: input.gymEquipmentId,
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        imageId: input.imageId,
      },
    });
  }

  async deleteGymEquipmentImage(imageId: string) {
    await this.prisma.gymEquipmentImage.delete({
      where: { id: imageId },
    });
    return true;
  }

  async getGymEquipment(gymId: number) {
    return this.prisma.gymEquipment.findMany({
      where: { gymId },
      include: { equipment: true, images: true },
    });
  }

  async getGymEquipmentDetail(gymEquipmentId: number) {
    return this.prisma.gymEquipment.findUnique({
      where: { id: gymEquipmentId },
      include: { equipment: true, images: true },
    });
  }
}
