import { GraphQLError } from 'graphql';

import { UpsertImageEmbeddingDto } from './embedding.dto';
import { EmbeddingService, getLatestEmbeddedImageService } from './embedding.service';
import { validateInput } from '../../middlewares/validation';
import type { AuthContext } from '../auth/auth.types';

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
    imageEmbedding: async (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new EmbeddingService(context.prisma);
      return service.getById(args.id);
    },
    async getLatestEmbeddedImage(_: any, { input }: any) {
      const { scope, gymId } = input || {};
      if (!scope) {
        throw new GraphQLError('scope is required', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if ((scope === 'GYM' || scope === 'AUTO') && !gymId) {
        throw new GraphQLError('gymId is required for this scope', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const row = await getLatestEmbeddedImageService(input);
      return row;
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
    deleteImageEmbedding: async (_: unknown, args: { id: string }, context: AuthContext) => {
      const service = new EmbeddingService(context.prisma);
      return service.delete(args.id);
    },
  },
};
