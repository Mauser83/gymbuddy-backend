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

    allEquipments: async (_: unknown, __: unknown, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.getAllEquipments();
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

    updateEquipment: async (_: any, args: { id: number; input: any }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.updateEquipment(args.id, args.input, context);
    },

    deleteEquipment: async (_: any, args: { id: number }, context: AuthContext) => {
      const service = new EquipmentService(context.prisma, new PermissionService(context.prisma));
      return service.deleteEquipment(args.id, context);
    },
  },
};
