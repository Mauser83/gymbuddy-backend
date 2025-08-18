export const knnTypeDefs = `
  input KnnSearchInput {
    imageId: ID
    vector: [Float!]
    scope: String!
    limit: Int = 10
  }

  type KnnHit {
    imageId: ID!
    equipmentId: Int!
    score: Float!
    storageKey: String!
  }

  extend type Query {
    knnSearch(input: KnnSearchInput!): [KnnHit!]!
  }
`;