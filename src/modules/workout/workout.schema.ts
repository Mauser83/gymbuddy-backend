export const workoutTypeDefs = `#graphql
  type Workout {
    id: ID!
    name: String!
    description: String
  }

  input CreateWorkoutInput {
    name: String!
    description: String
    isPublic: Boolean
  }

  input UpdateWorkoutInput {
    name: String
    description: String
  }

  extend type Query {
    workouts: [Workout]
  }

  extend type Mutation {
    createWorkout(input: CreateWorkoutInput!): Workout
    updateWorkout(id: ID!, input: UpdateWorkoutInput!): Workout
    deleteWorkout(id: ID!): String
    shareWorkout(workoutId: ID!, shareWithUserId: ID): Workout
  }
`;
