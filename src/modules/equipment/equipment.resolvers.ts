import { EquipmentSuggestionService } from './equipment-suggestion.service';
import { EquipmentUpdateSuggestionService } from './equipment-update-suggestion.service';
import { EquipmentService } from './equipment.service';
import type { AuthContext } from '../auth/auth.types';
import { PermissionService } from '../core/permission.service';

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

  EquipmentSuggestion: {
    gym: (parent: any, _: any, context: AuthContext) => {
      if (!parent.gymId) return null;
      return context.prisma.gym.findUnique({ where: { id: parent.gymId } });
    },
    manager: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.user.findUnique({ where: { id: parent.managerUserId } });
    },
    category: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findUnique({ where: { id: parent.categoryId } });
    },
    subcategory: (parent: any, _: any, context: AuthContext) => {
      if (!parent.subcategoryId) return null;
      return context.prisma.equipmentSubcategory.findUnique({
        where: { id: parent.subcategoryId },
      });
    },
    approvedEquipment: (parent: any, _: any, context: AuthContext) => {
      if (!parent.approvedEquipmentId) return null;
      return context.prisma.equipment.findUnique({ where: { id: parent.approvedEquipmentId } });
    },
    images: (parent: any, _: any, context: AuthContext) => {
      if (parent.images) return parent.images;
      return context.prisma.equipmentSuggestionImage.findMany({
        where: { suggestionId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  EquipmentUpdateSuggestion: {
    equipment: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.equipment.findUnique({ where: { id: parent.equipmentId } });
    },
  },

  EquipmentSuggestionImage: {
    thumbUrl: async (
      src: { storageKey: string },
      args: { ttlSec?: number },
      context: AuthContext,
    ) => {
      if (!src.storageKey) return null;
      return context.mediaService.presignGetForKey(src.storageKey, args.ttlSec ?? 300);
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

  EquipmentImage: {
    thumbUrl: async (
      src: { storageKey: string },
      args: { ttlSec?: number },
      context: AuthContext,
    ) => {
      if (!src.storageKey) return null;
      return context.mediaService.presignGetForKey(src.storageKey, args.ttlSec ?? 300);
    },
  },

  Query: {
    equipment: async (_: unknown, args: { id: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getEquipment(args.id);
    },

    allEquipments: async (_: unknown, args: { search?: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getAllEquipments(args.search);
    },

    equipmentCategories: async (_: any, __: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findMany({
        include: { subcategories: true },
      });
    },

    equipmentSubcategories: async (_: any, args: { categoryId?: number }, context: AuthContext) => {
      return context.prisma.equipmentSubcategory.findMany({
        where: args.categoryId ? { categoryId: args.categoryId } : {},
      });
    },

    gymEquipmentByGymId: async (_: unknown, args: { gymId: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getGymEquipmentByGymId(args.gymId);
    },

    equipmentImagesByEquipmentId: async (
      _: unknown,
      args: { equipmentId: number },
      context: AuthContext,
    ) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getEquipmentImages(args.equipmentId);
    },

    equipmentImage: async (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getEquipmentImageById(args.id);
    },

    listEquipmentSuggestions: async (_: unknown, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.listSuggestions(args.input, context);
    },
  },

  Mutation: {
    createEquipment: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipment(args.input, context);
    },

    updateEquipment: async (_: any, args: { id: number; input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipment(args.id, args.input, context);
    },

    deleteEquipment: async (_: any, args: { id: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipment(args.id, context);
    },

    uploadEquipmentImage: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.uploadEquipmentImage(args.input, context);
    },

    deleteEquipmentImage: async (_: any, args: { imageId: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipmentImage(args.imageId, context);
    },

    createEquipmentCategory: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipmentCategory(args.input, context);
    },

    updateEquipmentCategory: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext,
    ) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipmentCategory(args.id, args.input, context);
    },

    deleteEquipmentCategory: async (_: any, args: { id: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipmentCategory(args.id, context);
    },

    createEquipmentSubcategory: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipmentSubcategory(args.input, context);
    },

    updateEquipmentSubcategory: async (
      _: any,
      args: { id: number; input: any },
      context: AuthContext,
    ) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipmentSubcategory(args.id, args.input, context);
    },

    deleteEquipmentSubcategory: async (_: any, args: { id: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipmentSubcategory(args.id, context);
    },

    createEquipmentSuggestion: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.createSuggestion(args.input, context);
    },

    createEquipmentSuggestionUploadTicket: async (
      _: any,
      args: { input: any },
      context: AuthContext,
    ) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.createUploadTicket(args.input, context);
    },

    finalizeEquipmentSuggestionImages: async (
      _: any,
      args: { input: any },
      context: AuthContext,
    ) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.finalizeImages(args.input, context);
    },

    approveEquipmentSuggestion: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.approve(args.input, context);
    },

    rejectEquipmentSuggestion: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentSuggestionService(
        context.prisma,
        new PermissionService(context.prisma),
      );
      return service.reject(args.input, context);
    },
    createEquipmentUpdateSuggestion: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentUpdateSuggestionService(context.prisma);
      return service.create(args.input, context);
    },
    approveEquipmentUpdateSuggestion: async (
      _: any,
      args: { input: any },
      context: AuthContext,
    ) => {
      const service = new EquipmentUpdateSuggestionService(context.prisma);
      return service.approve(args.input, context);
    },
    rejectEquipmentUpdateSuggestion: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentUpdateSuggestionService(context.prisma);
      return service.reject(args.input, context);
    },
  },
};
