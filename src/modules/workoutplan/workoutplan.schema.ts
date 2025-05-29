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
    workoutTypes: [WorkoutType!]!    # ✅ now a list
  }

  type WorkoutType {
    id: Int!
    name: String!
    slug: String!
    categories: [WorkoutCategory!]!  # ✅ now a list
  }

  type MuscleGroup {
    id: Int!
    name: String!
    slug: String!
    bodyParts: [BodyPart!]!  # ✅ New field
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

    type WorkoutProgram {
    id: Int!
    name: String!
    notes: String
    userId: Int!
    user: User!
    createdAt: String!
    updatedAt: String!
    days: [WorkoutProgramDay!]!
    cooldowns: [WorkoutProgramMuscleCooldown!]!
    assignments: [WorkoutProgramAssignment!]!
  }

  type WorkoutProgramDay {
    id: Int!
    programId: Int!
    program: WorkoutProgram!
    dayOfWeek: Int!
    workoutPlanId: Int!
    workoutPlan: WorkoutPlan!
    notes: String
    assignments: [WorkoutProgramAssignment!]!
  }

  type WorkoutProgramMuscleCooldown {
    id: Int!
    programId: Int!
    program: WorkoutProgram!
    muscleGroupId: Int!
    muscleGroup: MuscleGroup!
    daysRequired: Int!
  }

  type UserMuscleCooldownOverride {
    id: Int!
    userId: Int!
    user: User!
    muscleGroupId: Int!
    muscleGroup: MuscleGroup!
    daysRequired: Int!
    notes: String
  }

  type WorkoutProgramAssignment {
    id: Int!
    userId: Int!
    user: User!
    programDayId: Int!
    programDay: WorkoutProgramDay!
    scheduledDate: String!
    status: AssignmentStatus!
    overrideDate: String
  }

  type UserWorkoutPreferences {
    id: Int!
    userId: Int!
    user: User!
    preferredWorkoutDays: [Int!]!
    preferredRestDays: [Int!]!
    autoReschedule: Boolean!
  }

  input WorkoutPlanExerciseInput {
    exerciseId: Int!
    order: Int!
    targetSets: Int!
    targetReps: Int!
    targetWeight: Float
    targetRpe: Float!
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
    workoutTypeId: Int!
    muscleGroupIds: [Int!]!
    exercises: [WorkoutPlanExerciseInput!]!
  }

  input CreateWorkoutCategoryInput {
    name: String!
    slug: String!
  }

  input UpdateWorkoutCategoryInput {
    name: String
    slug: String
    workoutTypeIds: [Int!] # ✅ Add this line
  }

  input CreateWorkoutTypeInput {
    name: String!
    slug: String!
    categoryIds: [Int!]!    # ✅ required list
  }

  input UpdateWorkoutTypeInput {
    name: String
    slug: String
    categoryIds: [Int!]     # ✅ optional list
  }

  input CreateMuscleGroupInput {
    name: String!
    slug: String!
    bodyPartIds: [Int!]! # 👈 Add this line
  }

  input UpdateMuscleGroupInput {
    name: String
    slug: String
    bodyPartIds: [Int!] # 👈 Add this line
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

    input CreateWorkoutProgramInput {
    name: String!
    notes: String
  }

  input UpdateWorkoutProgramInput {
    name: String
    notes: String
  }

  input CreateWorkoutProgramDayInput {
    programId: Int!
    dayOfWeek: Int!
    workoutPlanId: Int!
    notes: String
  }

  input UpdateWorkoutProgramDayInput {
    dayOfWeek: Int
    workoutPlanId: Int
    notes: String
  }

  input CreateWorkoutProgramCooldownInput {
    programId: Int!
    muscleGroupId: Int!
    daysRequired: Int!
  }

  input CreateWorkoutProgramAssignmentInput {
    userId: Int!
    programDayId: Int!
    scheduledDate: String!
    overrideDate: String
  }

  input SetUserWorkoutPreferencesInput {
    preferredWorkoutDays: [Int!]!
    preferredRestDays: [Int!]!
    autoReschedule: Boolean
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

    getWorkoutPrograms: [WorkoutProgram!]!
    getWorkoutProgramById(id: Int!): WorkoutProgram
    getUserWorkoutPreferences: UserWorkoutPreferences
  }

  extend type Mutation {
    createWorkoutPlan(input: CreateWorkoutPlanInput!): WorkoutPlan
    updateWorkoutPlan(id: Int!, input: UpdateWorkoutPlanInput!): WorkoutPlan!
    deleteWorkoutPlan(id: Int!): String

    shareWorkoutPlan(workoutPlanId: Int!, shareWithUserId: Int): WorkoutPlan
    shareWorkoutProgram(programId: Int!, shareWithUserId: Int): WorkoutProgram

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

    createWorkoutProgram(input: CreateWorkoutProgramInput!): WorkoutProgram!
    updateWorkoutProgram(id: Int!, input: UpdateWorkoutProgramInput!): WorkoutProgram!
    deleteWorkoutProgram(id: Int!): Boolean!

    createWorkoutProgramDay(input: CreateWorkoutProgramDayInput!): WorkoutProgramDay!
    updateWorkoutProgramDay(id: Int!, input: UpdateWorkoutProgramDayInput!): WorkoutProgramDay!
    deleteWorkoutProgramDay(id: Int!): Boolean!

    createWorkoutProgramCooldown(input: CreateWorkoutProgramCooldownInput!): WorkoutProgramMuscleCooldown!
    deleteWorkoutProgramCooldown(id: Int!): Boolean!

    createWorkoutProgramAssignment(input: CreateWorkoutProgramAssignmentInput!): WorkoutProgramAssignment!
    deleteWorkoutProgramAssignment(id: Int!): Boolean!

    setUserWorkoutPreferences(input: SetUserWorkoutPreferencesInput!): UserWorkoutPreferences!
  }
`;
