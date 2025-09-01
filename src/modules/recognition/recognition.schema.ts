export const recognitionTypeDefs = `
  type RecognitionUploadTicket {
    ticketToken: String!
    storageKey: String!
    putUrl: String!
    expiresAt: DateTime!
  }

  type RecognitionAttempt {
    attemptId: ID!
    storageKey: String!
    vectorHash: String!
    bestEquipmentId: Int
    bestScore: Float!
    createdAt: DateTime!
    decision: String!
  }

  type RecognitionCandidate {
    equipmentId: Int!
    imageId: ID!
    score: Float!
    storageKey: String!
  }

  type RecognizeImagePayload {
    attempt: RecognitionAttempt!
    globalCandidates: [RecognitionCandidate!]!
    gymCandidates: [RecognitionCandidate!]!
  }

  input ConfirmRecognitionInput {
    attemptId: ID!
    selectedEquipmentId: Int!
    offerForTraining: Boolean = false
  }

  type ConfirmRecognitionPayload {
    saved: Boolean!
    promotedStorageKey: String
  }

  extend type Mutation {
    createRecognitionUploadTicket(gymId: Int!, ext: String!): RecognitionUploadTicket!
    recognizeImage(ticketToken: String!, limit: Int = 5): RecognizeImagePayload!
    confirmRecognition(input: ConfirmRecognitionInput!): ConfirmRecognitionPayload!
    discardRecognition(attemptId: ID!): Boolean!
  }
`;