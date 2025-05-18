export const exerciselogTypeDefs = `

  type ExerciseLog {
    id: Int!
    userId: Int!
    exerciseId: Int!
    workoutPlanId: Int
    workoutSessionId: Int
    workoutSession: WorkoutSession
    gymId: Int
    gymEquipmentId: Int
    rpe: Float
    notes: String
    createdAt: String!
    updatedAt: String!
  }

    type WorkoutSession {
    id: Int!
    userId: Int!
    startedAt: String!
    endedAt: String
    notes: String
    workoutPlanId: Int
    assignedWorkoutId: Int
    exerciseLogs: [ExerciseLog!]!
  }

  input CreateExerciseLogInput {
    exerciseId: Int!
    workoutPlanId: Int
    workoutSessionId: Int
    gymId: Int
    gymEquipmentId: Int
    rpe: Float
    notes: String
  }

  input UpdateExerciseLogInput {
    exerciseId: Int
    workoutPlanId: Int
    workoutSessionId: Int
    gymId: Int
    gymEquipmentId: Int
    rpe: Float
    notes: String
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
