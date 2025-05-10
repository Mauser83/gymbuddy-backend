export const exerciselogTypeDefs = `
  type ExerciseLog {
    id: ID!
    userId: Int!
    exerciseId: Int!
    workoutPlanId: Int
    sets: Int
    reps: Int
    weight: Float
    gymId: Int
    createdAt: String!
    updatedAt: String!
  }

  input CreateExerciseLogInput {
    exerciseId: Int!
    workoutPlanId: Int
    sets: Int
    reps: Int
    weight: Float
    gymId: Int
  }

  input UpdateExerciseLogInput {
    exerciseId: Int
    workoutPlanId: Int
    sets: Int
    reps: Int
    weight: Float
    gymId: Int
  }

  extend type Query {
    exerciseLogs: [ExerciseLog!]!
    exerciseLogById(id: Int!): ExerciseLog
  }

  extend type Mutation {
    createExerciseLog(input: CreateExerciseLogInput!): ExerciseLog!
    updateExerciseLog(id: Int!, input: UpdateExerciseLogInput!): ExerciseLog!
    deleteExerciseLog(id: Int!): Boolean!
  }
`;
