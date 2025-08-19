import { validateOrReject } from "class-validator";
import {
  FinalizeGymImageDto,
  PromoteGymImageDto,
  ApproveGymImageDto,
  RejectGymImageDto,
  CandidateGlobalImagesDto,
} from "./images.dto";
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

    approveGymImage: async (
      _parent: unknown,
      { input }: { input: ApproveGymImageDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new ApproveGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.approveGymImage(dto, ctx);
    },

    rejectGymImage: async (
      _parent: unknown,
      { input }: { input: RejectGymImageDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new RejectGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.rejectGymImage(dto, ctx);
    },
  },

  Query: {
    candidateGlobalImages: async (
      _parent: unknown,
      { input }: { input: CandidateGlobalImagesDto },
      ctx: AuthContext
    ) => {
      const dto = Object.assign(new CandidateGlobalImagesDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.candidateGlobalImages(dto);
    },
  },
};
