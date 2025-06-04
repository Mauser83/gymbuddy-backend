export const exerciseTypeDefs = `

  type Exercise {
    id: Int!
    name: String!
    description: String
    videoUrl: String
    userId: Int!
    createdAt: String!
    updatedAt: String!

    difficulty: ExerciseDifficulty!
    exerciseType: ExerciseType!
    primaryMuscles: [Muscle!]!
    secondaryMuscles: [Muscle!]!
    workoutPlanEntries: [WorkoutPlanExercise!]!

    equipmentSlots: [ExerciseEquipmentSlot!]!
  }

  type ExerciseEquipmentSlot {
    id: Int!
    slotIndex: Int!
    isRequired: Boolean!
    comment: String
    options: [ExerciseEquipmentOption!]!
  }

  type ExerciseEquipmentOption {
    id: Int!
    subcategory: EquipmentSubcategory!
  }

  type EquipmentSubcategory {
    id: Int!
    name: String!
    slug: String!
    category: EquipmentCategory!
  }

  type EquipmentCategory {
    id: Int!
    name: String!
    slug: String!
  }

  type Muscle {
    id: Int!
    name: String!
    bodyPart: BodyPart!
  }

  type BodyPart {
    id: Int!
    name: String!
    muscles: [Muscle!]!
  }

  type ExerciseType {
    id: Int!
    name: String!
    metricIds: [Int!]!           # Raw IDs
    metrics: [Metric!]!          # Resolved objects
  }

  type Metric {
    id: Int!
    name: String!
    slug: String!
    unit: String!
    inputType: String!
  }

  type ExerciseDifficulty {
    id: Int!
    level: String!
  }

  input CreateExerciseSlotOptionInput {
    subcategoryId: Int!
  }

  input CreateExerciseSlotInput {
    slotIndex: Int!
    isRequired: Boolean!
    comment: String
    options: [CreateExerciseSlotOptionInput!]!
  }

  input CreateExerciseInput {
    name: String!
    description: String
    videoUrl: String

    difficultyId: Int
    exerciseTypeId: Int
    primaryMuscleIds: [Int!]!
    secondaryMuscleIds: [Int!]
    equipmentSlots: [CreateExerciseSlotInput!]!
  }

  input UpdateExerciseInput {
    name: String
    description: String
    videoUrl: String

    difficultyId: Int
    exerciseTypeId: Int
    primaryMuscleIds: [Int!]
    secondaryMuscleIds: [Int!]
    equipmentSlots: [CreateExerciseSlotInput!]
  }

  input CreateExerciseTypeInput {
    name: String!
    metricIds: [Int!]!      # ✅ Required on creation
  }

  input UpdateExerciseTypeInput {
    name: String!
    metricIds: [Int!]!      # ✅ Required on update
  }

  input CreateMetricInput {
    name: String!
    slug: String!
    unit: String!
    inputType: String!  # e.g. "number", "time", "text"
  }

  input UpdateMetricInput {
    name: String
    slug: String
    unit: String
    inputType: String
  }

  input CreateExerciseDifficultyInput {
    level: String!
  }

  input UpdateExerciseDifficultyInput {
    level: String!
  }

  input CreateBodyPartInput {
    name: String!
  }

  input UpdateBodyPartInput {
    name: String!
  }

  input CreateMuscleInput {
    name: String!
    bodyPartId: Int!
  }

  input UpdateMuscleInput {
    name: String!
    bodyPartId: Int!
  }

  input ExerciseFilterInput {
    exerciseType: [String]
    difficulty: [String]
    bodyPart: [String]
    muscle: [String]
  }

  extend type Query {
    getExercises(search: String, filters: ExerciseFilterInput): [Exercise!]!
    getExerciseById(id: Int!): Exercise

    allExerciseTypes: [ExerciseType!]!
    allExerciseDifficulties: [ExerciseDifficulty!]!
    allBodyParts: [BodyPart!]!
    musclesByBodyPart(bodyPartId: Int!): [Muscle!]!

    exercisesAvailableAtGym(gymId: Int!, search: String): [Exercise!]!

    allMetrics: [Metric!]!
    metricById(id: Int!): Metric
  }

  extend type Mutation {
    createExercise(input: CreateExerciseInput!): Exercise!
    updateExercise(id: Int!, input: UpdateExerciseInput!): Exercise!
    deleteExercise(id: Int!): Boolean!

    createExerciseType(input: CreateExerciseTypeInput!): ExerciseType!
    updateExerciseType(id: Int!, input: UpdateExerciseTypeInput!): ExerciseType!
    deleteExerciseType(id: Int!): Boolean!

    createExerciseDifficulty(input: CreateExerciseDifficultyInput!): ExerciseDifficulty!
    updateExerciseDifficulty(id: Int!, input: UpdateExerciseDifficultyInput!): ExerciseDifficulty!
    deleteExerciseDifficulty(id: Int!): Boolean!

    createBodyPart(input: CreateBodyPartInput!): BodyPart!
    updateBodyPart(id: Int!, input: UpdateBodyPartInput!): BodyPart!
    deleteBodyPart(id: Int!): Boolean!

    createMuscle(input: CreateMuscleInput!): Muscle!
    updateMuscle(id: Int!, input: UpdateMuscleInput!): Muscle!
    deleteMuscle(id: Int!): Boolean!

    createMetric(input: CreateMetricInput!): Metric!
    updateMetric(id: Int!, input: UpdateMetricInput!): Metric!
    deleteMetric(id: Int!): Boolean!
  }
`;
