import { validateOrReject } from "class-validator";
import { GetImageUploadUrlDto } from "./media.dto";
import { AuthContext } from "../auth/auth.types";

export const MediaResolvers = {
  Mutation: {
    getImageUploadUrl: async (
      _: unknown,
      { input }: { input: GetImageUploadUrlDto },
      ctx: AuthContext
    ) => {
      // Authorization checks could be added here
      const dto = Object.assign(new GetImageUploadUrlDto(), input);
      await validateOrReject(dto);

      return ctx.mediaService.getImageUploadUrl({
        gymId: dto.gymId,
        contentType: dto.contentType,
        filename: dto.filename,
        ttlSec: dto.ttlSec,
      });
    },
  },
};