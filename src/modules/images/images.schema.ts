export const imagesTypeDefs = `
  enum SafetyState { PENDING COMPLETE FAILED }

  enum AdminImageListStatus { CANDIDATE APPROVED REJECTED QUARANTINED }

  enum TrainingCandidateStatus { PENDING QUARANTINED APPROVED REJECTED }

  input CandidateSafetyFilter {
    state: SafetyState
    flaggedOnly: Boolean
  }
    
  input FinalizeGymImageInput {
    storageKey: String!
    gymId: Int!
    equipmentId: Int!

    sha256: String

    angleId: Int
    heightId: Int
    lightingId: Int
    mirrorId: Int
    distanceId: Int
    sourceId: Int
    splitId: Int
  }

  input GymImageDefaults {
    gymId: Int!
    equipmentId: Int!
    sourceId: Int
    splitId: Int
    lightingId: Int
  }

  input FinalizeGymImageItem {
    storageKey: String!
    sha256: String
    angleId: Int
    heightId: Int
    distanceId: Int
    mirrorId: Int
    lightingId: Int
    splitId: Int
    sourceId: Int
  }

  input FinalizeGymImagesInput {
    sessionId: ID
    defaults: GymImageDefaults!
    items: [FinalizeGymImageItem!]!
  }

  type FinalizeGymImagesPayload {
    images: [GymEquipmentImage!]!
    queuedJobs: Int!
  }

  input ApplyTaxonomiesInput {
    imageIds: [ID!]!
    angleId: Int
    heightId: Int
    distanceId: Int
    lightingId: Int
    mirrorId: Int
    splitId: Int
    sourceId: Int
  }

  type ApplyTaxonomiesPayload { updatedCount: Int! }

  type FinalizeGymImageResult {
    image: GymEquipmentImage!
    queuedJobs: [String!]!
  }

  input PromoteGymImageInput {
    id: ID!
    splitId: Int
    force: Boolean = false
  }

  type PromoteGymImagePayload {
    equipmentImage: EquipmentImage!
    gymImage: GymEquipmentImage!
    destinationKey: String!
  }

  input ApproveGymImageInput {
    id: ID!
    force: Boolean = false
  }

  type ApproveGymImagePayload {
    gymImage: GymEquipmentImage!
  }

  input RejectGymImageInput {
    id: ID!
    reason: String
    deleteObject: Boolean = false
  }

  type RejectGymImagePayload {
    gymImage: GymEquipmentImage!
  }

  input ApproveTrainingCandidateInput {
    id: ID!
  }

  type ApproveTrainingCandidatePayload {
    approved: Boolean!
    imageId: ID
    storageKey: String
  }

  input RejectTrainingCandidateInput {
    id: ID!
    reason: String
  }

  type RejectTrainingCandidatePayload {
    rejected: Boolean!
  }

  input ListTrainingCandidatesInput {
    gymId: Int!
    status: TrainingCandidateStatus = PENDING
    equipmentId: Int
    q: String
    cursor: String
    limit: Int = 50
  }

  type TrainingCandidateRow {
    id: ID!
    gymId: Int!
    gymEquipmentId: Int!
    equipmentId: Int!
    equipmentName: String
    storageKey: String!
    url: String!
    status: TrainingCandidateStatus!
    safetyReasons: [String!]
    capturedAt: String
    uploader: User
    hash: String
    processedAt: String
  }

  type TrainingCandidateConnection {
    items: [TrainingCandidateRow!]!
    nextCursor: String
  }

  enum GlobalSuggestionStatus { PENDING APPROVED REJECTED }

  input ListGlobalSuggestionsInput {
    equipmentId: Int
    status: GlobalSuggestionStatus = PENDING
    minScore: Float
    limit: Int = 50
    cursor: String
  }

  type EquipmentSummary { id: Int!, name: String! }

  type GlobalSuggestionRow {
    id: ID!
    equipmentId: Int!
    equipment: EquipmentSummary!
    gymImageId: ID!
    storageKey: String!
    url: String!
    sha256: String!
    usefulnessScore: Float!
    reasonCodes: [String!]!
    nearDupImageId: ID
    createdAt: String!
  }

  type GlobalSuggestionConnection {
    items: [GlobalSuggestionRow!]!
    nextCursor: String
  }

  input ApproveGlobalSuggestionInput { id: ID! }
  input RejectGlobalSuggestionInput { id: ID!, reason: String }

  type ApproveGlobalSuggestionPayload { approved: Boolean!, imageId: ID, storageKey: String }
  type RejectGlobalSuggestionPayload { rejected: Boolean! }

  input CandidateGlobalImagesInput {
    equipmentId: Int!
    limit: Int = 50
    offset: Int = 0
    gymId: Int
    status: AdminImageListStatus
    search: String
    safety: CandidateSafetyFilter
  }

  type CandidateSafety {
    state: SafetyState!
    score: Float
    reasons: [String!]!
  }

  type CandidateTags {
    angleId: Int
    heightId: Int
    distanceId: Int
    lightingId: Int
    mirrorId: Int
    splitId: Int
    sourceId: Int
  }

  type CandidateGymImage {
    id: ID!
    gymId: Int!
    equipmentId: Int!
    storageKey: String!
    sha256: String
    status: GymImageStatus!
    approvedAt: String
    approvedBy: User
    createdAt: String!
    gymName: String!
    tags: CandidateTags
    safety: CandidateSafety
    dupCount: Int!
  }

  extend type Mutation {
    finalizeGymImage(input: FinalizeGymImageInput!): FinalizeGymImageResult!
    finalizeGymImages(input: FinalizeGymImagesInput!): FinalizeGymImagesPayload!
    applyTaxonomiesToGymImages(input: ApplyTaxonomiesInput!): ApplyTaxonomiesPayload!
    promoteGymImageToGlobal(input: PromoteGymImageInput!): PromoteGymImagePayload!
    approveGymImage(input: ApproveGymImageInput!): ApproveGymImagePayload!
    rejectGymImage(input: RejectGymImageInput!): RejectGymImagePayload!
    approveTrainingCandidate(input: ApproveTrainingCandidateInput!): ApproveTrainingCandidatePayload!
    rejectTrainingCandidate(input: RejectTrainingCandidateInput!): RejectTrainingCandidatePayload!
    approveGlobalSuggestion(input: ApproveGlobalSuggestionInput!): ApproveGlobalSuggestionPayload!
    rejectGlobalSuggestion(input: RejectGlobalSuggestionInput!): RejectGlobalSuggestionPayload!
  }

  extend type Query {
    candidateGlobalImages(input: CandidateGlobalImagesInput!): [CandidateGymImage!]!
    listTrainingCandidates(input: ListTrainingCandidatesInput!): TrainingCandidateConnection!
    listGlobalSuggestions(input: ListGlobalSuggestionsInput!): GlobalSuggestionConnection!
  }
`;
