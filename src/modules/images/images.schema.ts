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

  extend type Mutation {
    finalizeGymImage(input: FinalizeGymImageInput!): FinalizeGymImageResult!
  }
`;