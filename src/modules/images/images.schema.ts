export const imagesTypeDefs = `
  enum SafetyState { PENDING COMPLETE FAILED }

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

  input CandidateGlobalImagesInput {
    equipmentId: Int!
    limit: Int = 50
    offset: Int = 0
    gymId: Int
    status: GymImageStatus
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
  }

  extend type Query {
    candidateGlobalImages(input: CandidateGlobalImagesInput!): [CandidateGymImage!]!
  }
`;