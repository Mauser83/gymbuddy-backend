import type { AuthContext } from "../auth/auth.types";
import { QueueService } from "./queue.service";
import { EnqueueImageJobDto, UpdateImageJobStatusDto } from "./queue.dto";
import { validateInput } from "../../middlewares/validation";

export const QueueResolvers = {
  ImageQueue: {
    storageKey: (parent: { storageKey?: string }) => parent.storageKey,
  },
  Query: {
    imageJob: (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new QueueService(context.prisma);
      return service.getById(args.id);
    },
    imageJobs: (
      _: unknown,
      args: { status?: string; limit?: number },
      context: AuthContext
    ) => {
      const service = new QueueService(context.prisma);
      return service.list(args.status, args.limit ?? 50);
    },
  },
  Mutation: {
    enqueueImageJob: async (
      _: unknown,
      args: { input: EnqueueImageJobDto },
      context: AuthContext
    ) => {
      await validateInput(args.input, EnqueueImageJobDto);
      const service = new QueueService(context.prisma);
      return service.enqueue(args.input);
    },
    updateImageJobStatus: async (
      _: unknown,
      args: { input: UpdateImageJobStatusDto },
      context: AuthContext
    ) => {
      await validateInput(args.input, UpdateImageJobStatusDto);
      const service = new QueueService(context.prisma);
      return service.updateStatus(args.input);
    },
    deleteImageJob: (
      _: unknown,
      args: { id: string },
      context: AuthContext
    ) => {
      const service = new QueueService(context.prisma);
      return service.delete(args.id);
    },
  },
};
