export const embeddingTypeDefs = `
  extend type Query {
    imageEmbeddings(imageId: ID!, scope: String): [ImageEmbedding!]!
    imageEmbedding(id: ID!): ImageEmbedding
    latestEmbeddedImage(gymId: Int): LatestEmbeddedImage
  }

  extend type Mutation {
    # Worker/admin only — do NOT expose to regular clients
    upsertImageEmbedding(input: UpsertImageEmbeddingInput!): ImageEmbedding!
    deleteImageEmbedding(id: ID!): Boolean!
  }

  type ImageEmbedding {
    id: ID!
    imageId: ID!
    scope: String!
    modelVendor: String!
    modelName: String!
    modelVersion: String!
    dim: Int!
    createdAt: DateTime!
    # vector NOT exposed on the public API
  }

  type LatestEmbeddedImage {
    imageId: ID!
    createdAt: DateTime!
  }

  input UpsertImageEmbeddingInput {
    id: ID
    imageId: ID!
    scope: String!
    modelVendor: String!
    modelName: String!
    modelVersion: String!
    dim: Int!
    # vector omitted from API — the worker persists it internally
  }
`;