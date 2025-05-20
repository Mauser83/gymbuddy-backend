import type { AuthContext } from "../auth/auth.types";
import { EquipmentService } from "./equipment.service";
import { PermissionService } from "../core/permission.service";

export const EquipmentResolvers = {
  Equipment: {
    category: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findUnique({
        where: { id: parent.categoryId },
      });
    },

    subcategory: (parent: any, _: any, context: AuthContext) => {
      if (!parent.subcategoryId) return null;
      return context.prisma.equipmentSubcategory.findUnique({
        where: { id: parent.subcategoryId },
      });
    },

    images: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.equipmentImage.findMany({
        where: { equipmentId: parent.id },
      });
    },

    compatibleExercises: async (parent: any, _: any, context: AuthContext) => {
      if (!parent.subcategoryId) return [];

      return context.prisma.exercise.findMany({
        where: {
          deletedAt: null,
          equipmentSlots: {
            some: {
              options: {
                some: {
                  subcategoryId: parent.subcategoryId,
                },
              },
            },
          },
        },
      });
    },
  },

  EquipmentCategory: {
    subcategories: (parent: any, _: any, context: AuthContext) =>
      context.prisma.equipmentSubcategory.findMany({
        where: { categoryId: parent.id },
      }),
  },

  EquipmentSubcategory: {
    category: (parent: any, _: any, context: AuthContext) =>
      context.prisma.equipmentCategory.findUnique({
        where: { id: parent.categoryId },
      }),
  },

  Query: {
    equipment: async (
      _: unknown,
      args: { id: number },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getEquipment(args.id);
    },

    allEquipments: async (
      _: unknown,
      args: { search?: string },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getAllEquipments(args.search);
    },

    equipmentCategories: async (_: any, __: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findMany({
        include: { subcategories: true },
      });
    },

    equipmentSubcategories: async (
      _: any,
      args: { categoryId?: number },
      context: AuthContext
    ) => {
      return context.prisma.equipmentSubcategory.findMany({
        where: args.categoryId ? { categoryId: args.categoryId } : {},
      });
    },
  },

  Mutation: {
    createEquipment: async (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createEquipment(args.input, context);
    },

    updateEquipment: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateEquipment(args.id, args.input, context);
    },

    deleteEquipment: async (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteEquipment(args.id, context);
    },

    uploadEquipmentImage: async (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.uploadEquipmentImage(args.input, context);
    },

    deleteEquipmentImage: async (
      _: any,
      args: { imageId: number },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteEquipmentImage(args.imageId, context);
    },

    createEquipmentCategory: async (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createEquipmentCategory(args.input, context);
    },

    updateEquipmentCategory: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateEquipmentCategory(args.id, args.input, context);
    },

    deleteEquipmentCategory: async (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteEquipmentCategory(args.id, context);
    },

    createEquipmentSubcategory: async (
      _: any,
      args: { input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createEquipmentSubcategory(args.input, context);
    },

    updateEquipmentSubcategory: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateEquipmentSubcategory(args.id, args.input, context);
    },

    deleteEquipmentSubcategory: async (
      _: any,
      args: { id: number },
      context: AuthContext
    ) => {
      const service = new EquipmentService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteEquipmentSubcategory(args.id, context);
    },
  },
};
