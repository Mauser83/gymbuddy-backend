export const exerciseTypeDefs = `

  type Exercise {
    id: Int!
    name: String!
    description: String
    videoUrl: String
    userId: Int!
    createdAt: String!
    updatedAt: String!

    difficulty: ExerciseDifficulty
    exerciseType: ExerciseType
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
  }

  input UpdateExerciseTypeInput {
    name: String!
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

  extend type Query {
    getMyExercises: [Exercise!]!

    allExerciseTypes: [ExerciseType!]!
    allExerciseDifficulties: [ExerciseDifficulty!]!
    allBodyParts: [BodyPart!]!
    musclesByBodyPart(bodyPartId: Int!): [Muscle!]!
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
  }
`;
