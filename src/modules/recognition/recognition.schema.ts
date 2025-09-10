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

  type CandidateImage {
    imageId: ID!
    equipmentId: Int!
    gymId: Int
    storageKey: String!
    score: Float!
  }

  type EquipmentCandidate {
    equipmentId: Int!
    equipmentName: String
    topScore: Float!
    representative: CandidateImage!
    images: [CandidateImage!]!
    source: String!
    totalImagesConsidered: Int!
    lowConfidence: Boolean!
  }

  type RecognizeImagePayload {
    attempt: RecognitionAttempt!
    globalCandidates: [RecognitionCandidate!]!
    gymCandidates: [RecognitionCandidate!]!
    equipmentCandidates: [EquipmentCandidate!]!
  }

  input ConfirmRecognitionInput {
    attemptId: ID!
    selectedEquipmentId: Int!
    offerForTraining: Boolean = false
  }

  type ConfirmRecognitionPayload {
    saved: Boolean!
  }

  extend type Mutation {
    createRecognitionUploadTicket(gymId: Int!, input: UploadTicketInput!): RecognitionUploadTicket!
    recognizeImage(ticketToken: String!, limit: Int = 5): RecognizeImagePayload!
    confirmRecognition(input: ConfirmRecognitionInput!): ConfirmRecognitionPayload!
    discardRecognition(attemptId: ID!): Boolean!
  }
`;
