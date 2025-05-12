import type { AuthContext } from '../auth/auth.types';
import { EquipmentService } from './equipment.service';
import { PermissionService } from '../core/permission.service';

export const EquipmentResolvers = {
  Equipment: {
    gym: (parent: any, _: any, context: AuthContext) => {
      if (!parent.gymId) return null;
      return context.prisma.gym.findUnique({ where: { id: parent.gymId } });
    },
    category: (parent: any, _: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findUnique({ where: { id: parent.categoryId } });
    },
    subcategory: (parent: any, _: any, context: AuthContext) => {
      if (!parent.subcategoryId) return null;
      return context.prisma.equipmentSubcategory.findUnique({ where: { id: parent.subcategoryId } });
    },
  },

  EquipmentCategory: {
    subcategories: (parent: any, _: any, context: AuthContext) =>
      context.prisma.equipmentSubcategory.findMany({ where: { categoryId: parent.id } }),
  },

  EquipmentSubcategory: {
    category: (parent: any, _: any, context: AuthContext) =>
      context.prisma.equipmentCategory.findUnique({ where: { id: parent.categoryId } }),
  },

  Query: {
    equipment: async (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getEquipment(Number(args.id));
    },

    allEquipments: async (_: unknown, args: { search?: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getAllEquipments(args.search);
    },

    equipmentCategories: async (_: any, __: any, context: AuthContext) => {
      return context.prisma.equipmentCategory.findMany({ include: { subcategories: true } });
    },

    equipmentSubcategories: async (_: any, args: { categoryId?: number }, context: AuthContext) => {
      return context.prisma.equipmentSubcategory.findMany({
        where: args.categoryId ? { categoryId: args.categoryId } : {},
      });
    },
  },

  Mutation: {
    createEquipment: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipment(args.input, context);
    },

    updateEquipment: async (_: any, args: { id: string; input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipment(Number(args.id), args.input, context);
    },

    deleteEquipment: async (_: any, args: { id: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipment(Number(args.id), context);
    },

    createEquipmentCategory: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipmentCategory(args.input, context);
    },

    updateEquipmentCategory: async (_: any, args: { id: string; input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipmentCategory(Number(args.id), args.input, context);
    },

    deleteEquipmentCategory: async (_: any, args: { id: string }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipmentCategory(Number(args.id), context);
    },

    createEquipmentSubcategory: async (_: any, args: { input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.createEquipmentSubcategory(args.input, context);
    },

    updateEquipmentSubcategory: async (_: any, args: { id: string; input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipmentSubcategory(Number(args.id), args.input, context);
    },

    deleteEquipmentSubcategory: async (_: any, args: { id: string }, context: AuthContext) => {
      console.log("was called");
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipmentSubcategory(Number(args.id), context);
    },
  },
};
