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

    trainingGoal: TrainingGoal
    intensityPreset: IntensityPreset
    intensityPresetId: Int
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
    targetMetrics: [MetricTarget!]! 
    createdAt: String!
    updatedAt: String!
    isWarmup: Boolean
    groupId: String
    trainingMethod: TrainingMethod
    exercise: Exercise!
  }

  type MetricTarget {
    metricId: Int!
    min: Float!
    max: Float
  }

  type TrainingGoal {
    id: Int!
    name: String!
    slug: String!
    presets: [IntensityPreset!]!
    trainingMethods: [TrainingMethod!]!  # ✅ New — inverse link
  }

  enum ExperienceLevel {
    BEGINNER
    INTERMEDIATE
    ADVANCED
  }

  type IntensityPreset {
    id: Int!
    trainingGoalId: Int!
    trainingGoal: TrainingGoal!
    experienceLevel: ExperienceLevel!
    defaultSets: Int!
    defaultReps: Int!
    defaultRestSec: Int!
    defaultRpe: Float!
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
    trainingGoals: [TrainingGoal!]!  # ✅ New — linked goals
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
    targetMetrics: [TargetMetricInput!]!
    trainingMethodId: Int
    isWarmup: Boolean
  }

  input TargetMetricInput {
    metricId: Int!
    min: Float!
    max: Float
  }

  input CreateWorkoutPlanInput {
    name: String!
    description: String
    isPublic: Boolean
    trainingGoalId: Int!
    intensityPresetId: Int
    muscleGroupIds: [Int!]
    exercises: [WorkoutPlanExerciseInput!]
  }

  input UpdateWorkoutPlanInput {
    name: String
    description: String
    trainingGoalId: Int!
    intensityPresetId: Int
    muscleGroupIds: [Int!]!
    exercises: [WorkoutPlanExerciseInput!]!
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

  input TrainingGoalInput {
    name: String!
    slug: String!
  }

  input IntensityPresetInput {
    trainingGoalId: Int!
    experienceLevel: ExperienceLevel!
    defaultSets: Int!
    defaultReps: Int!
    defaultRestSec: Int!
    defaultRpe: Float!
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

input UpdateTrainingMethodGoalsInput {
  methodId: Int!
  goalIds: [Int!]!
}

  extend type Query {
    workoutPlans: [WorkoutPlan]
    workoutPlanById(id: Int!): WorkoutPlan
    sharedWorkoutPlans: [WorkoutPlan]

    # ➕ NEW: Root queries
    getMuscleGroups: [MuscleGroup!]!
    getTrainingMethods: [TrainingMethod!]!
    getTrainingMethodsByGoal(goalId: Int!): [TrainingMethod!]!

    getWorkoutPrograms: [WorkoutProgram!]!
    getWorkoutProgramById(id: Int!): WorkoutProgram
    getUserWorkoutPreferences: UserWorkoutPreferences

    getTrainingGoals: [TrainingGoal!]!
    getIntensityPresets(trainingGoalId: Int): [IntensityPreset!]!
  }

  extend type Mutation {
    createWorkoutPlan(input: CreateWorkoutPlanInput!): WorkoutPlan
    updateWorkoutPlan(id: Int!, input: UpdateWorkoutPlanInput!): WorkoutPlan!
    deleteWorkoutPlan(id: Int!): String

    shareWorkoutPlan(workoutPlanId: Int!, shareWithUserId: Int): WorkoutPlan
    shareWorkoutProgram(programId: Int!, shareWithUserId: Int): WorkoutProgram

    # MuscleGroup
    createMuscleGroup(input: CreateMuscleGroupInput!): MuscleGroup!
    updateMuscleGroup(id: Int!, input: UpdateMuscleGroupInput!): MuscleGroup!
    deleteMuscleGroup(id: Int!): Boolean!

    # TrainingMethod
    createTrainingMethod(input: CreateTrainingMethodInput!): TrainingMethod!
    updateTrainingMethod(id: Int!, input: UpdateTrainingMethodInput!): TrainingMethod!
    deleteTrainingMethod(id: Int!): Boolean!

    createTrainingGoal(input: TrainingGoalInput!): TrainingGoal!
    updateTrainingGoal(id: Int!, input: TrainingGoalInput!): TrainingGoal!
    deleteTrainingGoal(id: Int!): Boolean!

    createIntensityPreset(input: IntensityPresetInput!): IntensityPreset!
    updateIntensityPreset(id: Int!, input: IntensityPresetInput!): IntensityPreset!
    deleteIntensityPreset(id: Int!): Boolean!

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

    updateTrainingMethodGoals(input: LinkTrainingMethodToGoalsInput!): TrainingMethod!
  }
`;
