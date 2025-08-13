import { validateOrReject } from "class-validator";
import { FinalizeGymImageDto } from "./images.dto";
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
  },
};