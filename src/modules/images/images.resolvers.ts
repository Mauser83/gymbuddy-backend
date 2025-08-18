import { validateOrReject } from "class-validator";
import { FinalizeGymImageDto, PromoteGymImageDto } from "./images.dto";
import { AuthContext } from "../auth/auth.types";

export const ImagesResolvers = {
  Mutation: {
    finalizeGymImage: async (
      _parent: unknown,
      { input }: { input: FinalizeGymImageDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new FinalizeGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageIntakeService.finalizeGymImage(dto);
    },

    promoteGymImageToGlobal: async (
      _parent: unknown,
      { input }: { input: PromoteGymImageDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new PromoteGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.promoteGymImageToGlobal(dto, ctx);
    },
  },
};