import { knnSearchService } from "./knn.service";
import { GraphQLError } from "graphql";

export const KnnResolvers = {
  Query: {
    knnSearch: async (_: unknown, { input }: any) => {
      const { imageId, scope, limit, gymId } = input;
      if (!imageId) {
        throw new GraphQLError("imageId is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (scope === "GYM" && !gymId) {
        throw new GraphQLError("gymId is required for GYM scope", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const rows = await knnSearchService({ imageId, scope, limit, gymId });
      return rows.map((r) => ({
        imageId: r.id,
        equipmentId: r.equipmentId ?? null,
        score: r.score,
      }));
    },
  },
};