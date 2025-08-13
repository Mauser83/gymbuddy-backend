import type { AuthContext } from "../auth/auth.types";
import { EmbeddingService } from "./embedding.service";
import { UpsertImageEmbeddingDto } from "./embedding.dto";
import { validateInput } from "../../middlewares/validation";

export const EmbeddingResolvers = {
  Query: {
    imageEmbeddings: async (
      _: unknown,
      args: { imageId: string; scope?: string },
      context: AuthContext,
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.listByImage(args.imageId, args.scope);
    },
    imageEmbedding: async (
      _: unknown,
      args: { id: string },
      context: AuthContext,
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.getById(args.id);
    },
  },
  Mutation: {
    upsertImageEmbedding: async (
      _: unknown,
      args: { input: UpsertImageEmbeddingDto },
      context: AuthContext,
    ) => {
      await validateInput(args.input, UpsertImageEmbeddingDto);
      const service = new EmbeddingService(context.prisma);
      return service.upsert(args.input);
    },
    deleteImageEmbedding: async (
      _: unknown,
      args: { id: string },
      context: AuthContext,
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.delete(args.id);
    },
  },
};