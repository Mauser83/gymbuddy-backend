export const gymTypeDefs = `
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
    id: Int!
    gymEquipment: GymEquipment!
    url: String!
    createdAt: String
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

  input UploadGymEquipmentImageInput {
    gymEquipmentId: Int!
    url: String!
  }

  extend type Query {
    gyms(search: String): [Gym]
    gymById(id: Int!): Gym
    pendingGyms: [Gym]

    getGymEquipment(gymId: Int!): [GymEquipment!]!
    getGymEquipmentDetail(gymEquipmentId: Int!): GymEquipment
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
    uploadGymEquipmentImage(input: UploadGymEquipmentImageInput!): GymEquipmentImage!
    deleteGymEquipmentImage(imageId: Int!): Boolean!
  }

  extend type Subscription {
    gymApproved: Gym
    gymCreated: Gym!
  }
`;
