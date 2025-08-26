import { validateOrReject } from "class-validator";
import {
  GetImageUploadUrlDto,
  CreateUploadSessionDto,
  ImageUrlManyDto,
} from "./media.dto";
import { AuthContext } from "../auth/auth.types";

export const MediaResolvers = {
  Mutation: {
    getImageUploadUrl: async (
      _: unknown,
      { input }: { input: GetImageUploadUrlDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new GetImageUploadUrlDto(), input);
      await validateOrReject(dto);

      return ctx.mediaService.getImageUploadUrl({
        gymId: dto.gymId,
        contentType: dto.contentType,
        filename: dto.filename,
        ttlSec: dto.ttlSec,
      });
    },
  
    createUploadSession: async (
      _: unknown,
      { input }: { input: CreateUploadSessionDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new CreateUploadSessionDto(), input);
      await validateOrReject(dto);
      return ctx.mediaService.createUploadSession(dto);
    },
  },

  Query: {
    imageUrlMany: async (
      _: unknown,
      args: ImageUrlManyDto,
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new ImageUrlManyDto(), args);
      await validateOrReject(dto);
      return ctx.mediaService.imageUrlMany(dto.storageKeys, dto.ttlSec);
    },
  },
};