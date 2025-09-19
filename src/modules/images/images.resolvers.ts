import { validateOrReject } from 'class-validator';

import {
  FinalizeGymImageDto,
  FinalizeGymImagesDto,
  ApplyTaxonomiesDto,
  PromoteGymImageDto,
  ApproveGymImageDto,
  RejectGymImageDto,
  ApproveTrainingCandidateDto,
  RejectTrainingCandidateDto,
  CandidateGlobalImagesDto,
  ListTrainingCandidatesDto,
  ListGlobalSuggestionsDto,
  ApproveGlobalSuggestionDto,
  RejectGlobalSuggestionDto,
} from './images.dto';
import { AuthContext } from '../auth/auth.types';

export const ImagesResolvers = {
  TrainingCandidateRow: {
    url: (src: { storageKey: string }, _args: unknown, ctx: AuthContext) =>
      ctx.mediaService.presignGetForKey(src.storageKey, 300),
  },
  GlobalSuggestionRow: {
    url: (src: { storageKey: string }, _args: unknown, ctx: AuthContext) =>
      ctx.mediaService.presignGetForKey(src.storageKey, 300),
  },
  CandidateGymImage: {
    approvedBy: (
      src: { approvedByUserId?: number; approvedByUser?: any },
      _args: unknown,
      context: AuthContext,
    ) => {
      if (src.approvedByUser) return src.approvedByUser;
      if (src.approvedByUserId)
        return context.prisma.user.findUnique({
          where: { id: src.approvedByUserId },
        });
      return null;
    },
  },
  Mutation: {
    finalizeGymImage: async (
      _parent: unknown,
      { input }: { input: FinalizeGymImageDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new FinalizeGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageIntakeService.finalizeGymImage(dto);
    },

    finalizeGymImages: async (
      _parent: unknown,
      { input }: { input: FinalizeGymImagesDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new FinalizeGymImagesDto(), input);
      await validateOrReject(dto);
      return ctx.imageIntakeService.finalizeGymImages(dto, ctx.userId);
    },

    applyTaxonomiesToGymImages: async (
      _parent: unknown,
      { input }: { input: ApplyTaxonomiesDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ApplyTaxonomiesDto(), input);
      await validateOrReject(dto);
      return ctx.imageIntakeService.applyTaxonomiesToGymImages(dto);
    },

    promoteGymImageToGlobal: async (
      _parent: unknown,
      { input }: { input: PromoteGymImageDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new PromoteGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.promoteGymImageToGlobal(dto, ctx);
    },

    approveGymImage: async (
      _parent: unknown,
      { input }: { input: ApproveGymImageDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ApproveGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.approveGymImage(dto, ctx);
    },

    rejectGymImage: async (
      _parent: unknown,
      { input }: { input: RejectGymImageDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new RejectGymImageDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.rejectGymImage(dto, ctx);
    },

    approveTrainingCandidate: async (
      _parent: unknown,
      { input }: { input: ApproveTrainingCandidateDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ApproveTrainingCandidateDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.approveTrainingCandidate(dto, ctx);
    },

    rejectTrainingCandidate: async (
      _parent: unknown,
      { input }: { input: RejectTrainingCandidateDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new RejectTrainingCandidateDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.rejectTrainingCandidate(dto, ctx);
    },
    approveGlobalSuggestion: async (
      _parent: unknown,
      { input }: { input: ApproveGlobalSuggestionDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ApproveGlobalSuggestionDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.approveGlobalSuggestion(dto, ctx);
    },
    rejectGlobalSuggestion: async (
      _parent: unknown,
      { input }: { input: RejectGlobalSuggestionDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new RejectGlobalSuggestionDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.rejectGlobalSuggestion(dto, ctx);
    },
  },

  Query: {
    candidateGlobalImages: async (
      _parent: unknown,
      { input }: { input: CandidateGlobalImagesDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new CandidateGlobalImagesDto(), input);
      await validateOrReject(dto);
      return ctx.imageModerationService.candidateGlobalImages(dto);
    },
    listTrainingCandidates: async (
      _parent: unknown,
      { input }: { input: ListTrainingCandidatesDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ListTrainingCandidatesDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.listTrainingCandidates(dto, ctx);
    },
    listGlobalSuggestions: async (
      _parent: unknown,
      { input }: { input: ListGlobalSuggestionsDto },
      ctx: AuthContext,
    ) => {
      const dto = Object.assign(new ListGlobalSuggestionsDto(), input);
      await validateOrReject(dto);
      return ctx.imagePromotionService.listGlobalSuggestions(dto, ctx);
    },
  },
};
