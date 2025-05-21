export const exerciselogTypeDefs = `

  type ExerciseLog {
    id: Int!
    exerciseId: Int!
    gymEquipmentId: Int!
    workoutSessionId: Int!
    setNumber: Int!
    reps: Int!
    weight: Float!
    rpe: Float
    notes: String
    createdAt: String!
    updatedAt: String!
    workoutSession: WorkoutSession
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
    gymEquipmentId: Int!
    workoutSessionId: Int!
    setNumber: Int!
    reps: Int!
    weight: Float!
    rpe: Float
    notes: String
  }

  input UpdateExerciseLogInput {
    setNumber: Int
    reps: Int
    weight: Float
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
