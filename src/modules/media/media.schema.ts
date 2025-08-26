export const mediaTypeDefs = `
  input GetImageUploadUrlInput {
    gymId: Int!
    contentType: String!
    filename: String
    ttlSec: Int = 300
  }

  type HeaderKV {
    name: String!
    value: String!
  }

  type PresignedUpload {
    url: String!
    key: String!
    expiresAt: DateTime!
    requiredHeaders: [HeaderKV!]!
  }

  input CreateUploadSessionInput {
    gymId: Int!
    count: Int!
    contentTypes: [String!]!
    filenamePrefix: String
    equipmentId: Int
  }

  type PresignItem {
    url: String!
    storageKey: String!
    expiresAt: DateTime!
    requiredHeaders: [HeaderKV!]!
  }

  type CreateUploadSessionPayload {
    sessionId: ID!
    items: [PresignItem!]!
    expiresAt: DateTime!
  }

  type ImageUrlItem {
    storageKey: String!
    url: String!
    expiresAt: DateTime!
  }

  extend type Mutation {
    getImageUploadUrl(input: GetImageUploadUrlInput!): PresignedUpload!
    createUploadSession(input: CreateUploadSessionInput!): CreateUploadSessionPayload!
  }

  extend type Query {
    imageUrlMany(storageKeys: [String!]!, ttlSec: Int = 600): [ImageUrlItem!]!
  }
`;