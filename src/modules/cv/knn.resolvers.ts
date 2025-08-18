import type { AuthContext } from "../auth/auth.types";
import { KnnService, KnnSearchInput } from "./knn.service";

export const KnnResolvers = {
  Query: {
    knnSearch: async (
      _: unknown,
      args: { input: KnnSearchInput },
      context: AuthContext,
    ) => {
      const service = new KnnService(context.prisma);
      return service.knnSearch(args.input);
    },
  },
};