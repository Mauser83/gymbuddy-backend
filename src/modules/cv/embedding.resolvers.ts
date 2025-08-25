import type { AuthContext } from "../auth/auth.types";
import { GymRole } from "../auth/auth.types";
import { verifyGymScope } from "../auth/auth.roles";
import { GraphQLError } from "graphql";
import { EmbeddingService } from "./embedding.service";
import { UpsertImageEmbeddingDto } from "./embedding.dto";
import { validateInput } from "../../middlewares/validation";

export const EmbeddingResolvers = {
  Query: {
    imageEmbeddings: async (
      _: unknown,
      args: { imageId: string; scope?: string },
      context: AuthContext
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.listByImage(args.imageId, args.scope);
    },
    imageEmbedding: async (
      _: unknown,
      args: { id: string },
      context: AuthContext
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.getById(args.id);
    },
    latestEmbeddedImage: async (
      _: unknown,
      args: { gymId?: number },
      context: AuthContext
    ) => {
      let { gymId } = args;

      if (!gymId) {
        if (context.appRole !== "ADMIN") {
          const adminRole = context.gymRoles.find(
            (r) => r.role === GymRole.GYM_ADMIN
          );
          if (adminRole) {
            gymId = adminRole.gymId;
          } else {
            throw new GraphQLError("gymId required");
          }
        }
      } else {
        verifyGymScope(context, context.permissionService, gymId, [
          GymRole.GYM_ADMIN,
        ]);
      }

      const service = new EmbeddingService(context.prisma);
      return service.getLatestEmbeddedImage(gymId ?? undefined);
    },
  },
  Mutation: {
    upsertImageEmbedding: async (
      _: unknown,
      args: { input: UpsertImageEmbeddingDto },
      context: AuthContext
    ) => {
      await validateInput(args.input, UpsertImageEmbeddingDto);
      const service = new EmbeddingService(context.prisma);
      return service.upsert(args.input);
    },
    deleteImageEmbedding: async (
      _: unknown,
      args: { id: string },
      context: AuthContext
    ) => {
      const service = new EmbeddingService(context.prisma);
      return service.delete(args.id);
    },
  },
};
