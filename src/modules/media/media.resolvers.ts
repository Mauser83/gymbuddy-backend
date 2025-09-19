import { validateOrReject } from 'class-validator';
import { GraphQLError } from 'graphql';

import {
  GetImageUploadUrlDto,
  CreateUploadSessionDto,
  ImageUrlManyDto,
  ImageUrlDto,
} from './media.dto';
import { AuthContext } from '../auth/auth.types';

export const MediaResolvers = {
  Mutation: {
    getImageUploadUrl: async (
      _: unknown,
      { input }: { input: GetImageUploadUrlDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new GetImageUploadUrlDto(), input);
      await validateOrReject(dto);

      return ctx.mediaService.getImageUploadUrl({
        gymId: dto.gymId,
        contentType: dto.contentType,
        filename: dto.filename,
        sha256: dto.sha256,
        contentLength: dto.contentLength,
        ttlSec: dto.ttlSec,
      });
    },

    createUploadSession: async (
      _: unknown,
      { input }: { input: CreateUploadSessionDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new CreateUploadSessionDto(), input);
      await validateOrReject(dto);
      return ctx.mediaService.createUploadSession(dto);
    },
  },

  Query: {
    imageUrl: async (_: unknown, args: ImageUrlDto, ctx: AuthContext) => {
      const dto = Object.assign(new ImageUrlDto(), args);
      await validateOrReject(dto);

      const privateMatch = /^private\/uploads\/(\d+)\//.exec(dto.storageKey);
      if (privateMatch) {
        const gymId = parseInt(privateMatch[1], 10);
        const allowed = ctx.gymRoles.some((g) => g.gymId === gymId);
        if (!allowed) {
          throw new GraphQLError('Forbidden', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      const { url, expiresAt } = await ctx.mediaService.imageUrl(
        dto.storageKey,
        dto.ttlSec,
        ctx.userId ?? undefined,
      );
      return { storageKey: dto.storageKey, url, expiresAt };
    },
    imageUrlMany: async (_: unknown, args: ImageUrlManyDto, ctx: AuthContext) => {
      const dto = Object.assign(new ImageUrlManyDto(), args);
      await validateOrReject(dto);
      return ctx.mediaService.imageUrlMany(dto.storageKeys, dto.ttlSec);
    },
  },
};
