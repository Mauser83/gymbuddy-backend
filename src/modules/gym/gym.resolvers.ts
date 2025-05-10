import { AuthContext } from '../auth/auth.types';
import { GymService } from "./gym.service";
import { PermissionService } from "../core/permission.service";
import { CreateGymInput, UpdateGymInput } from "./gym.types";
import { CreateGymDto, UpdateGymDto } from "./gym.dto";
import { validateInput } from "../../middlewares/validation";

export const GymResolvers = {
  Gym: {
    gymRoles: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymManagementRole.findMany({
        where: { gymId: parent.id },
        include: { user: true },
      });
    },
    equipment: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.equipment.findMany({
        where: { gymId: parent.id },
      });
    },
    trainers: (parent: any, _args: any, context: AuthContext) => {
      return context.prisma.gymTrainer.findMany({
        where: { gymId: parent.id },
        include: { user: true },
      });
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
      return service.getGyms(
        context.userId ? Number(context.userId) : undefined,
        args.search
      );
    },
    gymById: async (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getGymById(
        Number(args.id),
        Number(context.userId),
        context.appRole
      );
    },
    pendingGyms: async (_: unknown, __: unknown, context: AuthContext) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.getPendingGyms(Number(context.userId));
    },
  },
  Mutation: {
    createGym: async (
      _: any,
      args: { input: CreateGymInput },
      context: AuthContext
    ) => {
      await validateInput(args.input, CreateGymDto);
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.createGym(Number(context.userId), args.input);
    },

    updateGym: async (
      _: any,
      args: { id: string; input: UpdateGymInput },
      context: AuthContext
    ) => {
      await validateInput(args.input, UpdateGymDto);
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.updateGym(
        Number(context.userId),
        Number(args.id),
        args.input,
        context.appRole
      );
    },
    approveGym: async (
      _: any,
      args: { gymId: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.approveGym(Number(context.userId), Number(args.gymId));
    },
    deleteGym: async (_: any, args: { id: string }, context: AuthContext) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.deleteGym(
        Number(context.userId),
        Number(args.id),
        context.appRole
      );
    },
    addTrainer: async (
      _: any,
      args: { gymId: string; userId: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.addTrainer(
        Number(context.userId),
        Number(args.gymId),
        Number(args.userId)
      );
    },
    removeTrainer: async (
      _: any,
      args: { gymId: string; userId: string },
      context: AuthContext
    ) => {
      const service = new GymService(
        context.prisma,
        new PermissionService(context.prisma)
      );
      return service.removeTrainer(
        Number(context.userId),
        Number(args.gymId),
        Number(args.userId)
      );
    },
  },
};
