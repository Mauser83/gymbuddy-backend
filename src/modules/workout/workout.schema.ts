export const workoutTypeDefs = `#graphql
  type Workout {
    id: Int!
    name: String!
    description: String
    version: Int!
    parentPlanId: Int
    isPublic: Boolean
    createdAt: String!
    updatedAt: String!

    exercises: [WorkoutPlanExercise!]!
    assignedWorkouts: [AssignedWorkout!]!
    sessions: [WorkoutSession!]!
  }

  type WorkoutPlanExercise {
    id: Int!
    workoutPlanId: Int!
    exerciseId: Int!
    order: Int
    targetSets: Int
    targetReps: Int
    targetWeight: Float
    targetRpe: Float
    createdAt: String!
    updatedAt: String!
    exercise: Exercise!
  }

    type AssignedWorkout {
    id: Int!
    workoutPlanId: Int!
    trainerId: Int!
    assigneeId: Int!
    scheduledFor: String!
    status: AssignmentStatus!
    feedback: String
    createdAt: String!

    workoutPlan: Workout!
    trainer: User!
    assignee: User!
    sessions: [WorkoutSession!]!
  }

  enum AssignmentStatus {
    PENDING
    COMPLETED
    MISSED
  }

  input WorkoutPlanExerciseInput {
    exerciseId: Int!
    order: Int
    targetSets: Int
    targetReps: Int
    targetWeight: Float
    targetRpe: Float
  }

  input CreateWorkoutInput {
    name: String!
    description: String
    isPublic: Boolean
    exercises: [WorkoutPlanExerciseInput!]
  }

  input UpdateWorkoutInput {
    name: String
    description: String
    exercises: [WorkoutPlanExerciseInput!]
  }

  extend type Query {
    workouts: [Workout]
    workoutById(id: Int!): Workout
  }

  extend type Mutation {
    createWorkout(input: CreateWorkoutInput!): Workout
    updateWorkout(id: Int!, input: UpdateWorkoutInput!): Workout
    deleteWorkout(id: Int!): String
    shareWorkout(workoutId: Int!, shareWithUserId: Int): Workout

    # ➕ NEW: Create a new version of an existing workout
    createWorkoutVersion(parentPlanId: Int!, input: CreateWorkoutInput!): Workout
  }
`;
