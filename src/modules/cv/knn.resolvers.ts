import { knnSearchService } from "./knn.service";
import { GraphQLError } from "graphql";

export const KnnResolvers = {
  Query: {
    knnSearch: async (_: unknown, { input }: any) => {
      const { imageId, scope, limit, gymId, minScore } = input;
      if (!imageId) {
        throw new GraphQLError("imageId is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if ((scope === "GYM" || scope === "AUTO") && !gymId) {
        throw new GraphQLError("gymId is required for this scope", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const rows = await knnSearchService({ imageId, scope, limit, gymId, minScore });
      return rows.map((r) => ({
        imageId: r.id,
        equipmentId: r.equipmentId ?? null,
        score: r.score,
        storageKey: r.storageKey,
      }));
    },
  },
};