import { AuthContext } from "../auth/auth.types";
import { GymService } from "./gym.service";
import { PermissionService } from "../core/permission.service";
import {
  CreateGymInput,
  UpdateGymInput,
  AssignEquipmentToGymInput,
  UpdateGymEquipmentInput,
  UploadGymEquipmentImageInput,
} from "./gym.types";

export const GymResolvers = {
  Gym: {
    gymRoles: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymManagementRole.findMany({
        where: { gymId: parent.id },
        include: { user: true },
      });
    },
    gymEquipment: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymEquipment.findMany({
        where: { gymId: parent.id },
        include: { equipment: true, images: true },
      });
    },
    trainers: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymTrainer.findMany({
        where: { gymId: parent.id },
        include: { user: true },
      });
    },
      exerciseLogs: (parent: any, _: any, context: AuthContext) => {
    return context.prisma.exerciseLog.findMany({
      where: { gymId: parent.id },
    });
  },
  },

  Query: {
    gyms: async (_: unknown, args: { search?: string }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.getGyms(context.userId ?? undefined, args.search);
    },

    gymById: async (_: unknown, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.getGymById(args.id, context.userId, context.appRole);
    },

    pendingGyms: async (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.getPendingGyms(context.userId);
    },

    getGymEquipment: async (_: unknown, args: { gymId: number }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.getGymEquipment(args.gymId);
    },

    getGymEquipmentDetail: async (
      _: unknown,
      args: { gymEquipmentId: number },
      context: AuthContext
    ) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.getGymEquipmentDetail(args.gymEquipmentId);
    },
  },

  Mutation: {
    createGym: async (_: any, args: { input: CreateGymInput }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.createGym(context.userId, args.input);
    },

    updateGym: async (_: any, args: { id: number; input: UpdateGymInput }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.updateGym(context.userId, args.id, args.input, context.appRole);
    },

    approveGym: async (_: any, args: { gymId: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.approveGym(context.userId, args.gymId);
    },

    deleteGym: async (_: any, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.deleteGym(context.userId, args.id, context.appRole);
    },

    addTrainer: async (_: any, args: { gymId: number; userId: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.addTrainer(context.userId, args.gymId, args.userId);
    },

    removeTrainer: async (_: any, args: { gymId: number; userId: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.removeTrainer(context.userId, args.gymId, args.userId);
    },

    assignEquipmentToGym: async (_: any, args: { input: AssignEquipmentToGymInput }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.assignEquipmentToGym(args.input);
    },

    updateGymEquipment: async (_: any, args: { input: UpdateGymEquipmentInput }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.updateGymEquipment(args.input);
    },

    removeGymEquipment: async (_: any, args: { gymEquipmentId: number }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.removeGymEquipment(args.gymEquipmentId);
    },

    uploadGymEquipmentImage: async (_: any, args: { input: UploadGymEquipmentImageInput }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.uploadGymEquipmentImage(args.input);
    },

    deleteGymEquipmentImage: async (_: any, args: { imageId: number }, context: AuthContext) => {
      const service = new GymService(context.prisma, new PermissionService(context.prisma));
      return service.deleteGymEquipmentImage(args.imageId);
    },
  },
};
