import type { AuthContext } from '../auth/auth.types';

export const RecognitionResolvers = {
  Mutation: {
    createRecognitionUploadTicket: async (_: unknown, args: { gymId: number; ext: string }, ctx: AuthContext) => {
      return ctx.recognitionService.createUploadTicket(args.gymId, args.ext);
    },
    recognizeImage: async (_: unknown, args: { ticketToken: string; limit?: number }, ctx: AuthContext) => {
      return ctx.recognitionService.recognizeImage(args.ticketToken, args.limit);
    },
    confirmRecognition: async (
      _: unknown,
      { input }: { input: { attemptId: string; selectedEquipmentId: number; offerForTraining?: boolean } },
      ctx: AuthContext
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