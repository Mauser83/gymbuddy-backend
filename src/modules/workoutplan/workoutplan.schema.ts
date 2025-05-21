export const workoutplanTypeDefs = `#graphql
  type WorkoutPlan {
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

    workoutPlan: WorkoutPlan!
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

  input CreateWorkoutPlanInput {
    name: String!
    description: String
    isPublic: Boolean
    exercises: [WorkoutPlanExerciseInput!]
  }

  input UpdateWorkoutPlanInput {
    name: String
    description: String
    exercises: [WorkoutPlanExerciseInput!]
  }

  extend type Query {
    workoutPlans: [WorkoutPlan]
    workoutPlanById(id: Int!): WorkoutPlan
    sharedWorkoutPlans: [WorkoutPlan]
  }

  extend type Mutation {
    createWorkoutPlan(input: CreateWorkoutPlanInput!): WorkoutPlan
    updateWorkoutPlan(id: Int!, input: UpdateWorkoutPlanInput!): WorkoutPlan
    deleteWorkoutPlan(id: Int!): String
    shareWorkoutPlan(workoutPlanId: Int!, shareWithUserId: Int): WorkoutPlan

    # ➕ NEW: Create a new version of an existing workout
    createWorkoutPlanVersion(parentPlanId: Int!, input: CreateWorkoutPlanInput!): WorkoutPlan
  }
`;
