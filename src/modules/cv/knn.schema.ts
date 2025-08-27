export const knnTypeDefs = `
    enum KnnScope {
      GLOBAL
      GYM
      AUTO
    }

    input KnnSearchInput {
      imageId: ID!
      scope: KnnScope!
      gymId: Int
      limit: Int = 10
      minScore: Float = 0.72
    }

  type KnnNeighbor {
    imageId: ID!
    equipmentId: Int
    score: Float!
    storageKey: String!
  }

  extend type Query {
    knnSearch(input: KnnSearchInput!): [KnnNeighbor!]!
  }
`;