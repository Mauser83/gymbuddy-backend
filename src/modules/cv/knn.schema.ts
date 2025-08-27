export const knnTypeDefs = `
  enum KnnScope {
    GLOBAL
    GYM
  }

  input KnnSearchInput {
    imageId: ID!
    scope: KnnScope!
    limit: Int = 10
    gymId: Int
  }

  type KnnNeighbor {
    imageId: ID!
    equipmentId: Int
    score: Float!
  }

  extend type Query {
    knnSearch(input: KnnSearchInput!): [KnnNeighbor!]!
  }
`;