export const exerciselogTypeDefs = `

  type ExerciseLog {
    id: Int!
    exerciseId: Int!
    equipmentIds: [Int!]!
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
    gymId: Int!
    workoutPlanId: Int
    assignedWorkoutId: Int
    gym: Gym
    workoutPlan: WorkoutPlan
    exerciseLogs: [ExerciseLog!]!
  }

  input CreateExerciseLogInput {
    exerciseId: Int!
    equipmentIds: [Int!]!
    workoutSessionId: Int!
    setNumber: Int!
    reps: Int!
    weight: Float!
    rpe: Float
    notes: String
  }

  input UpdateExerciseLogInput {
    equipmentIds: [Int!]
    setNumber: Int
    reps: Int
    weight: Float
    rpe: Float
    notes: String
  }

input CreateWorkoutSessionInput {
  userId: Int!
  gymId: Int!
  startedAt: String!
  workoutPlanId: Int
  assignedWorkoutId: Int
  notes: String
}

  input UpdateWorkoutSessionInput {
    endedAt: String
    notes: String
  }

  extend type Query {
    exerciseLogs: [ExerciseLog!]!
    exerciseLogById(id: Int!): ExerciseLog

    workoutSessionById(id: Int!): WorkoutSession
    workoutSessionsByUser(userId: Int!): [WorkoutSession!]!
    activeWorkoutSession(userId: Int!): WorkoutSession
  }

  extend type Mutation {
    createExerciseLog(input: CreateExerciseLogInput!): ExerciseLog!
    updateExerciseLog(id: Int!, input: UpdateExerciseLogInput!): ExerciseLog!
    deleteExerciseLog(id: Int!): Boolean!

    createWorkoutSession(input: CreateWorkoutSessionInput!): WorkoutSession!
    updateWorkoutSession(id: Int!, input: UpdateWorkoutSessionInput!): WorkoutSession!
    deleteWorkoutSession(id: Int!): Boolean!
  }
`;
