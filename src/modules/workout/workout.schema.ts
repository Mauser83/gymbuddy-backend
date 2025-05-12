export const workoutTypeDefs = `#graphql
  type Workout {
    id: Int!
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
    updateWorkout(id: Int!, input: UpdateWorkoutInput!): Workout
    deleteWorkout(id: Int!): String
    shareWorkout(workoutId: Int!, shareWithUserId: Int): Workout
  }
`;
