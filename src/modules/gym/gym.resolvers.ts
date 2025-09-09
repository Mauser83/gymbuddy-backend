import { AuthContext, AppRole } from "../auth/auth.types";
import { GymService } from "./gym.service";
import { PermissionService } from "../core/permission.service";
import {
  CreateGymInput,
  UpdateGymInput,
  AssignEquipmentToGymInput,
  UpdateGymEquipmentInput,
  CreateAdminUploadTicketInput,
} from "./gym.types";
import { UploadGymImageDto } from "./gym.dto";
import type { UploadTicketInput } from "../media/media.types";

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
    exerciseLogs: async (parent: any, _: any, context: AuthContext) => {
      const equipment = await context.prisma.gymEquipment.findMany({
        where: { gymId: parent.id },
        select: { id: true },
      });

      const equipmentIds = equipment.map((e) => e.id);

      const logs = await context.prisma.exerciseLogEquipment.findMany({
        where: {
          gymEquipmentId: { in: equipmentIds },
        },
        include: {
          exerciseLog: true,
        },
      });

      return logs.map((r) => r.exerciseLog);
    },
    images: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymEquipmentImage.findMany({
        where: { gymId: parent.id },
        include: { image: true },
        orderBy: { capturedAt: "desc" },
      });
    },
  },

  GymEquipmentImage: {
    capturedAt: (src: { capturedAt?: string; updatedAt?: string }) =>
      src.capturedAt ?? src.updatedAt ?? new Date(0).toISOString(),
    createdAt: (src: { capturedAt?: string; updatedAt?: string }) =>
      src.capturedAt ?? src.updatedAt ?? new Date(0).toISOString(),
    thumbUrl: async (
      src: { storageKey: string },
      args: { ttlSec?: number },
      context: AuthContext
    ) => {
      if (!src.storageKey) return null;
      if (src.storageKey.startsWith("private/uploads/")) {
        // potential auth check can go here
      }
      return context.mediaService.presignGetForKey(
        src.storageKey,
        args.ttlSec ?? 300
      );
    },
    url: async (
      src: { storageKey: string },
      _args: unknown,
      context: AuthContext
    ) => {
      if (!src.storageKey) return null;
      return context.mediaService.presignGetForKey(src.storageKey, 300);
    },
    approvedBy: (
      src: { approvedByUserId?: number; approvedByUser?: any },
      _args: unknown,
      context: AuthContext
    ) => {
      if (src.approvedByUser) return src.approvedByUser;
      if (src.approvedByUserId)
        return context.prisma.user.findUnique({
          where: { id: src.approvedByUserId },
        });
      return null;
    },
  },

  Query: {
    gyms: async (
      _: unknown,
      args: { search?: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGyms(context.userId ?? undefined, args.search);
    },

    gym: async (_: unknown, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymById(args.id, context.userId, context.appRole);
    },

    pendingGyms: async (_: unknown, __: unknown, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getPendingGyms(context.userId);
    },

    getGymEquipment: async (
      _: unknown,
      args: { gymId: number },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymEquipment(args.gymId);
    },

    getGymEquipmentDetail: async (
      _: unknown,
      args: { gymEquipmentId: number },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymEquipmentDetail(args.gymEquipmentId);
    },

    gymImagesByGymId: async (
      _: unknown,
      args: { gymId: number },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymImagesByGymId(args.gymId);
    },

    gymImage: async (
      _: unknown,
      args: { id: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymImageById(args.id);
    },
    listGymEquipmentImages: async (
      _: unknown,
      args: { gymEquipmentId: number; limit?: number; cursor?: string },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.listGymEquipmentImages(
        context.userId,
        args.gymEquipmentId,
        args.limit,
        args.cursor
      );
    },
    getImageProcessingStatus: async (
      _: unknown,
      args: { imageId: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getImageProcessingStatus(args.imageId);
    },
  },

  Mutation: {
    createGym: async (
      _: any,
      args: { input: CreateGymInput },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createGym(context.userId, args.input);
    },

    updateGym: async (
      _: any,
      args: { id: number; input: UpdateGymInput },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateGym(
        context.userId,
        args.id,
        args.input,
        context.appRole
      );
    },

    approveGym: async (
      _: any,
      args: { gymId: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.approveGym(context.userId, args.gymId);
    },

    deleteGym: async (_: any, args: { id: number }, context: AuthContext) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteGym(context.userId, args.id, context.appRole);
    },

    addTrainer: async (
      _: any,
      args: { gymId: number; userId: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.addTrainer(context.userId, args.gymId, args.userId);
    },

    removeTrainer: async (
      _: any,
      args: { gymId: number; userId: number },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.removeTrainer(context.userId, args.gymId, args.userId);
    },

    assignEquipmentToGym: async (
      _: any,
      args: { input: AssignEquipmentToGymInput },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.assignEquipmentToGym(args.input);
    },

    updateGymEquipment: async (
      _: any,
      args: { input: UpdateGymEquipmentInput },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateGymEquipment(args.input);
    },

    removeGymEquipment: async (
      _: any,
      args: { gymEquipmentId: number },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.removeGymEquipment(args.gymEquipmentId);
    },

    uploadGymImage: async (
      _: any,
      args: { input: UploadGymImageDto },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.uploadGymImage(args.input);
    },

    deleteGymImage: async (
      _: any,
      args: { imageId: string },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteGymImage(context.userId, args.imageId);
    },
    createAdminUploadTicket: async (
      _parent: unknown,
      args: { input: CreateAdminUploadTicketInput },
      context: AuthContext
    ) => {
      if (context.appRole !== AppRole.ADMIN) {
        throw new Error("Forbidden: admin only");
      }
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createAdminUploadTicket({
        gymId: args.input.gymId,
        upload: args.input.upload,
        ttlSec: args.input.ttlSec ?? 600,
        requestedByUserId: context.userId,
      });
    },
    createEquipmentTrainingUploadTicket: async (
      _: unknown,
      args: { gymId: number; equipmentId: number; input: UploadTicketInput },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createEquipmentTrainingUploadTicket(
        context.userId,
        args.gymId,
        args.equipmentId,
        args.input
      );
    },
    finalizeEquipmentTrainingImage: async (
      _: unknown,
      args: { gymEquipmentId: number; storageKey: string },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.finalizeEquipmentTrainingImage(
        context.userId,
        args.gymEquipmentId,
        args.storageKey
      );
    },
    finalizeGymImagesAdmin: async (
      _: unknown,
      args: {
        input: {
          gymId: number;
          equipmentId: number;
          storageKeys: string[];
        };
      },
      context: AuthContext
    ) => {
      if (context.appRole !== AppRole.ADMIN) {
        throw new Error("Forbidden");
      }
      const normalized = {
        defaults: {
          gymId: args.input.gymId,
          equipmentId: args.input.equipmentId,
        },
        items: args.input.storageKeys.map((k) => ({ storageKey: k })),
      };
      const result = await context.imageIntakeService.finalizeGymImagesAdmin(
        normalized,
        context.userId ?? null
      );
      console.log(
        "finalizeGymImagesAdmin returning",
        result.images.map((i) => ({ id: i.id, storageKey: i.storageKey }))
      );
      return result;
    },
    setPrimaryGymEquipmentImage: async (
      _: unknown,
      args: { imageId: string },
      context: AuthContext
    ) => {
      if (!context.userId) throw new Error("Unauthenticated: userId is null.");
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.setPrimaryGymEquipmentImage(context.userId, args.imageId);
    },
  },
};
