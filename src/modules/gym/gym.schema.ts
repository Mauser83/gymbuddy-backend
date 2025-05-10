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
    address: String!  # required
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

    equipment: [Equipment!]!
    trainers: [User!]!
    gymRoles: [GymManagementRole!]!
  }

  input CreateGymInput {
    name: String!
    description: String
    country: String!
    countryCode: String
    state: String
    stateCode: String
    city: String!
    address: String!  # required
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

  extend type Query {
    gyms(search: String): [Gym]
    gymById(id: ID!): Gym
    pendingGyms: [Gym]
  }

  extend type Mutation {
    createGym(input: CreateGymInput!): Gym
    updateGym(id: ID!, input: UpdateGymInput!): Gym
    approveGym(gymId: ID!): String
    deleteGym(id: ID!): String
    addTrainer(gymId: ID!, userId: ID!): String
    removeTrainer(gymId: ID!, userId: ID!): String
  }

  extend type Subscription {
    gymApproved: Gym
    gymCreated: Gym!
  }
`;
