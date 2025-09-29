import type { AuthContext } from '../auth/auth.types';
import type { UploadTicketInput } from '../media/media.types';

export const RecognitionResolvers = {
  Mutation: {
    createRecognitionUploadTicket: async (
      _: unknown,
      args: { gymId: number; input: UploadTicketInput },
      ctx: AuthContext,
    ) => {
      return ctx.recognitionService.createUploadTicket(args.gymId, args.input);
    },
    recognizeImage: async (
      _: unknown,
      args: { ticketToken: string; limit?: number },
      ctx: AuthContext,
    ) => {
      const rawLimit = args.limit ?? 3;
      const limit = Math.min(Math.max(rawLimit, 1), 10);
      const res = await ctx.recognitionService.recognizeImage(args.ticketToken, limit);
      return {
        ...res,
        gymCandidates: res.gymCandidates ?? [],
        globalCandidates: res.globalCandidates ?? [],
        equipmentCandidates: res.equipmentCandidates ?? [],
      };
    },
    recognizeCatalogEquipment: async (
      _: unknown,
      args: { ticketToken: string; limit?: number },
      ctx: AuthContext,
    ) => {
      const rawLimit = args.limit ?? 5;
      const limit = Math.min(Math.max(rawLimit, 1), 10);
      const res = await ctx.recognitionService.recognizeCatalogEquipmentByTicket(
        args.ticketToken,
        limit,
      );
      return {
        ...res,
        gymCandidates: res.gymCandidates ?? [],
        globalCandidates: res.globalCandidates ?? [],
        equipmentCandidates: res.equipmentCandidates ?? [],
      };
    },
    confirmRecognition: async (
      _: unknown,
      {
        input,
      }: { input: { attemptId: string; selectedEquipmentId: number; offerForTraining?: boolean } },
      ctx: AuthContext,
    ) => {
      return ctx.recognitionService.confirmRecognition({
        attemptId: BigInt(input.attemptId),
        selectedEquipmentId: input.selectedEquipmentId,
        offerForTraining: input.offerForTraining ?? false,
        uploaderUserId: ctx.userId ?? null,
      });
    },
    discardRecognition: async (_: unknown, args: { attemptId: string }, ctx: AuthContext) => {
      return ctx.recognitionService.discardRecognition(BigInt(args.attemptId));
    },
  },
};
