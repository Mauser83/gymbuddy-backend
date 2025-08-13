import { PrismaClient } from "../../lib/prisma";
import {
  CreateEquipmentInput,
  UpdateEquipmentInput,
  CreateEquipmentCategoryInput,
  CreateEquipmentSubcategoryInput,
  UpdateEquipmentCategoryInput,
  UpdateEquipmentSubcategoryInput,
} from "./equipment.types";
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
  UploadEquipmentImageDto,
  DeleteEquipmentImageDto,
  CreateEquipmentCategoryDto,
  UpdateEquipmentCategoryDto,
  CreateEquipmentSubcategoryDto,
  UpdateEquipmentSubcategoryDto,
} from "./equipment.dto";
import { validateInput } from "../../middlewares/validation";
import { AuthContext } from "../auth/auth.types";
import { PermissionService } from "../core/permission.service";
import { verifyRoles } from "../auth/auth.roles";

export class EquipmentService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  async createEquipment(input: CreateEquipmentInput, context: AuthContext) {
    await validateInput(input, CreateEquipmentDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipment.create({
      data: { ...input },
    });
  }

  async getEquipment(id: number) {
    return this.prisma.equipment.findUnique({
      where: { id },
    });
  }

  async getAllEquipments(search?: string) {
    return this.prisma.equipment.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
              {
                subcategory: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : undefined,
      include: {
        category: true,
        subcategory: true,
      },
    });
  }

  async getGymEquipmentByGymId(gymId: number) {
    return this.prisma.gymEquipment.findMany({
      where: { gymId },
      include: {
        equipment: {
          include: {
            subcategory: {
              select: { id: true },
            },
          },
        },
      },
    });
  }

  async updateEquipment(
    id: number,
    input: UpdateEquipmentInput,
    context: AuthContext
  ) {
    await validateInput(input, UpdateEquipmentDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipment.update({
      where: { id },
      data: { ...input },
    });
  }

  async deleteEquipment(id: number, context: AuthContext) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipment.delete({
      where: { id },
    });
  }

    async uploadEquipmentImage(
    input: UploadEquipmentImageDto,
    context: AuthContext
  ) {
    await validateInput(input, UploadEquipmentImageDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentImage.create({
      data: {
        equipmentId: input.equipmentId,
        storageKey: input.storageKey,
        sha256: input.sha256 ?? undefined,
        ...(context.userId
          ? { uploadedByUserId: context.userId }
          : {}),
      } as any,
    });
  }

  async deleteEquipmentImage(imageId: string, context: AuthContext) {
    await validateInput({ imageId }, DeleteEquipmentImageDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    await this.prisma.equipmentImage.delete({
      where: { id: imageId },
    });
    return true;
  }

  async getEquipmentImages(equipmentId: number) {
    return this.prisma.equipmentImage.findMany({
      where: { equipmentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getEquipmentImageById(imageId: string) {
    return this.prisma.equipmentImage.findUnique({ where: { id: imageId } });
  }

  async createEquipmentCategory(
    input: CreateEquipmentCategoryInput,
    context: AuthContext
  ) {
    await validateInput(input, CreateEquipmentCategoryDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentCategory.create({ data: input });
  }

  async updateEquipmentCategory(
    id: number,
    input: UpdateEquipmentCategoryInput,
    context: AuthContext
  ) {
    await validateInput(input, UpdateEquipmentCategoryDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentCategory.update({ where: { id }, data: input });
  }

  async deleteEquipmentCategory(id: number, context: AuthContext) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentCategory.delete({ where: { id } });
  }

  async createEquipmentSubcategory(
    input: CreateEquipmentSubcategoryInput,
    context: AuthContext
  ) {
    await validateInput(input, CreateEquipmentSubcategoryDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentSubcategory.create({ data: input });
  }

  async updateEquipmentSubcategory(
    id: number,
    input: UpdateEquipmentSubcategoryInput,
    context: AuthContext
  ) {
    await validateInput(input, UpdateEquipmentSubcategoryDto);

    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentSubcategory.update({
      where: { id },
      data: input,
    });
  }

  async deleteEquipmentSubcategory(id: number, context: AuthContext) {
    verifyRoles(context, {
      or: [{ requireAppRole: "ADMIN" }, { requireAppRole: "MODERATOR" }],
    });

    return this.prisma.equipmentSubcategory.delete({ where: { id } });
  }
}
