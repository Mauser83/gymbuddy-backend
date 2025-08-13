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

  extend type Mutation {
    getImageUploadUrl(input: GetImageUploadUrlInput!): PresignedUpload!
  }
`;