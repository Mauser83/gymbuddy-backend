export const imagesTypeDefs = `
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
    splitId: Int
    force: Boolean = false
  }

  type ApproveGymImagePayload {
    equipmentImage: EquipmentImage!
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
  }

  type CandidateGymImage {
    id: ID!
    gymId: Int!
    equipmentId: Int!
    storageKey: String!
    sha256: String
    status: String!
  }

  extend type Mutation {
    finalizeGymImage(input: FinalizeGymImageInput!): FinalizeGymImageResult!
    promoteGymImageToGlobal(input: PromoteGymImageInput!): PromoteGymImagePayload!
    approveGymImage(input: ApproveGymImageInput!): ApproveGymImagePayload!
    rejectGymImage(input: RejectGymImageInput!): RejectGymImagePayload!
  }

  extend type Query {
    candidateGlobalImages(input: CandidateGlobalImagesInput!): [CandidateGymImage!]!
  }
`;