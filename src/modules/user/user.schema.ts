export const userTypeDefs = `

  type User {
    id: ID!
    email: String!
    username: String
    appRole: String
    userRole: String
    createdAt: String!
    updatedAt: String!
    gymManagementRoles: [GymManagementRole]
  }

  type GymManagementRole {
    id: Int!
    role: GymRole!
    gym: Gym!
    user: User!
  }

  enum AppRole {
    ADMIN
    MODERATOR
  }

  enum UserRole {
    USER
    PREMIUM_USER
    PERSONAL_TRAINER
  }

  enum GymRole {
    GYM_MODERATOR
    GYM_ADMIN
  }

  input UpdateUserRolesInput {
    appRole: AppRole
    userRole: UserRole!
  }

  extend type Query {
    users(search: String): [User]
    userById(id: ID!): User
  }

  extend type Mutation {
    deleteUser(id: ID!): String
    updateUserRoles(userId: ID!, input: UpdateUserRolesInput!): User!
  }

  extend type Subscription {
    userRoleUpdated: User
    userUpdated: User
  }
`;
