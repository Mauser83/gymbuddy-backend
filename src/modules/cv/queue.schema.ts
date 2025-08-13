export const queueTypeDefs = `
  enum ImageJobStatus { pending running failed done }

  extend type Query {
    imageJob(id: ID!): ImageQueue
    imageJobs(status: ImageJobStatus, limit: Int = 50): [ImageQueue!]!
  }

  extend type Mutation {
    enqueueImageJob(input: EnqueueImageJobInput!): ImageQueue!
    updateImageJobStatus(input: UpdateImageJobStatusInput!): ImageQueue!
    deleteImageJob(id: ID!): Boolean!
  }

  type ImageQueue {
    id: ID!
    imageId: ID!
    jobType: String!
    status: ImageJobStatus!
    priority: Int!
    attempts: Int!
    lastError: String
    scheduledAt: DateTime
    startedAt: DateTime
    finishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input EnqueueImageJobInput {
    imageId: ID!
    jobType: String!
    priority: Int = 0
    scheduledAt: DateTime
  }

  input UpdateImageJobStatusInput {
    id: ID!
    status: ImageJobStatus!
    lastError: String
    attempts: Int
    startedAt: DateTime
    finishedAt: DateTime
  }
`;