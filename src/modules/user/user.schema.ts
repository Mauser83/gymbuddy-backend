export const userTypeDefs = `

  type User {
    id: Int!
    email: String!
    username: String
    appRole: String
    userRole: String
    createdAt: String!
    updatedAt: String!
    gymManagementRoles: [GymManagementRole]

    trainingGoal: TrainingGoal
    experienceLevel: ExperienceLevel

    # ➕ NEW FIELDS
    assignedWorkouts: [AssignedWorkout!]      # Plans assigned TO this user
    assignedByWorkouts: [AssignedWorkout!]    # Plans assigned BY this user (as trainer)
    workoutSessions: [WorkoutSession!]        # Grouped logs per session
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

  input UpdateUserTrainingPreferencesInput {
    trainingGoalId: Int
    experienceLevelId: Int
  }

  extend type Query {
    users(search: String): [User]
    userById(id: Int!): User
  }

  extend type Mutation {
    deleteUser(id: Int!): String
    updateUserRoles(userId: Int!, input: UpdateUserRolesInput!): User!
    updateUserTrainingPreferences(input: UpdateUserTrainingPreferencesInput!): User!
  }

  extend type Subscription {
    userRoleUpdated: User
    userUpdated: User
  }
`;
