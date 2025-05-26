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

    workoutType: WorkoutType
    muscleGroups: [MuscleGroup!]

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
    isWarmup: Boolean
    trainingMethod: TrainingMethod
    exercise: Exercise!
  }

  type WorkoutCategory {
    id: Int!
    name: String!
    slug: String!
    types: [WorkoutType!]!
  }

  type WorkoutType {
    id: Int!
    name: String!
    slug: String!
    category: WorkoutCategory!
  }

  type MuscleGroup {
    id: Int!
    name: String!
    slug: String!
  }

  type TrainingMethod {
    id: Int!
    name: String!
    slug: String!
    description: String
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
    trainingMethodId: Int
    isWarmup: Boolean
  }

  input CreateWorkoutPlanInput {
    name: String!
    description: String
    isPublic: Boolean
    workoutTypeId: Int
    muscleGroupIds: [Int!]
    exercises: [WorkoutPlanExerciseInput!]
  }

  input UpdateWorkoutPlanInput {
    name: String
    description: String
    workoutTypeId: Int
    muscleGroupIds: [Int!]
    exercises: [WorkoutPlanExerciseInput!]
  }

  input CreateWorkoutCategoryInput {
    name: String!
    slug: String!
  }

  input UpdateWorkoutCategoryInput {
    name: String
    slug: String
  }

  input CreateWorkoutTypeInput {
    name: String!
    slug: String!
    categoryId: Int!
  }

  input UpdateWorkoutTypeInput {
    name: String
    slug: String
    categoryId: Int
  }

  input CreateMuscleGroupInput {
    name: String!
    slug: String!
  }

  input UpdateMuscleGroupInput {
    name: String
    slug: String
  }

  input CreateTrainingMethodInput {
    name: String!
    slug: String!
    description: String
  }

  input UpdateTrainingMethodInput {
    name: String
    slug: String
    description: String
  }

  extend type Query {
    workoutPlans: [WorkoutPlan]
    workoutPlanById(id: Int!): WorkoutPlan
    sharedWorkoutPlans: [WorkoutPlan]

    # ➕ NEW: Root queries
    getWorkoutCategories: [WorkoutCategory!]!
    getWorkoutTypes: [WorkoutType!]!
    getMuscleGroups: [MuscleGroup!]!
    getTrainingMethods: [TrainingMethod!]!
  }

  extend type Mutation {
    createWorkoutPlan(input: CreateWorkoutPlanInput!): WorkoutPlan
    updateWorkoutPlan(id: Int!, input: UpdateWorkoutPlanInput!): WorkoutPlan
    deleteWorkoutPlan(id: Int!): String
    shareWorkoutPlan(workoutPlanId: Int!, shareWithUserId: Int): WorkoutPlan

    # WorkoutCategory
    createWorkoutCategory(input: CreateWorkoutCategoryInput!): WorkoutCategory!
    updateWorkoutCategory(id: Int!, input: UpdateWorkoutCategoryInput!): WorkoutCategory!
    deleteWorkoutCategory(id: Int!): Boolean!

    # WorkoutType
    createWorkoutType(input: CreateWorkoutTypeInput!): WorkoutType!
    updateWorkoutType(id: Int!, input: UpdateWorkoutTypeInput!): WorkoutType!
    deleteWorkoutType(id: Int!): Boolean!

    # MuscleGroup
    createMuscleGroup(input: CreateMuscleGroupInput!): MuscleGroup!
    updateMuscleGroup(id: Int!, input: UpdateMuscleGroupInput!): MuscleGroup!
    deleteMuscleGroup(id: Int!): Boolean!

    # TrainingMethod
    createTrainingMethod(input: CreateTrainingMethodInput!): TrainingMethod!
    updateTrainingMethod(id: Int!, input: UpdateTrainingMethodInput!): TrainingMethod!
    deleteTrainingMethod(id: Int!): Boolean!

    createWorkoutPlanVersion(parentPlanId: Int!, input: CreateWorkoutPlanInput!): WorkoutPlan
  }
`;
