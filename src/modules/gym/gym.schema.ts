export const gymTypeDefs = `
  enum GymImageStatus { PENDING APPROVED REJECTED }

  type Gym {
    id: Int!
    name: String!
    description: String
    country: String!
    countryCode: String
    state: String
    stateCode: String
    city: String!
    address: String!
    postalCode: String
    latitude: Float
    longitude: Float
    websiteUrl: String
    imageUrl: String
    phone: String
    email: String
    isApproved: Boolean!
    createdAt: String
    creator: User

    gymEquipment: [GymEquipment!]!
    trainers: [User!]!
    gymRoles: [GymManagementRole!]!
    exerciseLogs: [ExerciseLog!]!
    images: [GymEquipmentImage!]!
  }

  type GymEquipment {
    id: Int!
    gym: Gym!
    equipment: Equipment!
    quantity: Int!
    note: String
    images: [GymEquipmentImage!]!
    createdAt: String
    updatedAt: String
  }

  type GymEquipmentImage {
    id: ID!
    gymId: Int!
    equipmentId: Int!
    storageKey: String!
    sha256: String!
    status: GymImageStatus
    approvedAt: String
    approvedBy: User
    createdAt: String!
    updatedAt: String
    thumbUrl(ttlSec: Int = 300): String
    url: String!
  }

  type GymEquipmentImageConnection {
    items: [GymEquipmentImage!]!
    nextCursor: String
  }

  type UploadTicket {
    putUrl: String!
    storageKey: String!
  }

  input CreateGymInput {
    name: String!
    description: String
    country: String!
    countryCode: String
    state: String
    stateCode: String
    city: String!
    address: String!
    postalCode: String
    latitude: Float
    longitude: Float
    websiteUrl: String
    imageUrl: String
    phone: String
    email: String
  }

  input UpdateGymInput {
    name: String
    description: String
    country: String
    countryCode: String
    state: String
    stateCode: String
    city: String
    address: String
    postalCode: String
    latitude: Float
    longitude: Float
    websiteUrl: String
    imageUrl: String
    phone: String
    email: String
  }

  input AssignEquipmentToGymInput {
    gymId: Int!
    equipmentId: Int!
    quantity: Int!
    note: String
  }

  input UpdateGymEquipmentInput {
    gymEquipmentId: Int!
    quantity: Int
    note: String
  }

  input UploadGymImageInput {
    gymId: Int!
    equipmentId: Int!
    storageKey: String!
    sha256: String
    status: GymImageStatus
  }

  extend type Query {
    gyms(search: String): [Gym]
    gym(id: Int!): Gym
    pendingGyms: [Gym]

    getGymEquipment(gymId: Int!): [GymEquipment!]!
    getGymEquipmentDetail(gymEquipmentId: Int!): GymEquipment
    gymImagesByGymId(gymId: Int!): [GymEquipmentImage!]!
    gymImage(id: ID!): GymEquipmentImage
    listGymEquipmentImages(gymEquipmentId: Int!, limit: Int, cursor: String): GymEquipmentImageConnection!
  }

  extend type Mutation {
    createGym(input: CreateGymInput!): Gym
    updateGym(id: Int!, input: UpdateGymInput!): Gym
    approveGym(gymId: Int!): String
    deleteGym(id: Int!): String
    addTrainer(gymId: Int!, userId: Int!): String
    removeTrainer(gymId: Int!, userId: Int!): String

    assignEquipmentToGym(input: AssignEquipmentToGymInput!): GymEquipment!
    updateGymEquipment(input: UpdateGymEquipmentInput!): GymEquipment!
    removeGymEquipment(gymEquipmentId: Int!): Boolean!
    uploadGymImage(input: UploadGymImageInput!): GymEquipmentImage! @deprecated(reason: "Use createEquipmentTrainingUploadTicket/finalizeEquipmentTrainingImage")
    deleteGymImage(imageId: ID!): Boolean!
    createEquipmentTrainingUploadTicket(gymId: Int!, equipmentId: Int!, ext: String!): UploadTicket!
    finalizeEquipmentTrainingImage(gymEquipmentId: Int!, storageKey: String!): GymEquipmentImage!
  }

  extend type Subscription {
    gymApproved: Gym
    gymCreated: Gym!
  }
`;
