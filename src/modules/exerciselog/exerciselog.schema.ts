export const exerciselogTypeDefs = `
  type ExerciseLog {
    id: Int!
    userId: Int!
    exerciseId: Int!
    workoutPlanId: Int
    sets: Int
    reps: Int
    weight: Float
    gymId: Int
    gymEquipmentId: Int
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
    gymEquipmentId: Int
  }

  input UpdateExerciseLogInput {
    exerciseId: Int
    workoutPlanId: Int
    sets: Int
    reps: Int
    weight: Float
    gymId: Int
    gymEquipmentId: Int
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
