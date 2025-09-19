export const mediaTypeDefs = `
  input UploadTicketInput {
    ext: String!
    contentType: String
    contentLength: Int
    sha256: String
  }

  input GetImageUploadUrlInput {
    gymId: Int!
    contentType: String!
    filename: String
    sha256: String
    contentLength: Int
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
    expiresAtMs: Float!
    alreadyUploaded: Boolean!
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
    expiresAtMs: Float!
    alreadyUploaded: Boolean!
    requiredHeaders: [HeaderKV!]!
  }

  type CreateUploadSessionPayload {
    sessionId: ID!
    items: [PresignItem!]!
    expiresAt: DateTime!
    expiresAtMs: Float!
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
    imageUrl(storageKey: String!, ttlSec: Int = 300): ImageUrlItem!
  }
`;
