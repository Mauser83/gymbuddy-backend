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
    equipments: [Equipment!]!
    workoutPlanEntries: [WorkoutPlanExercise!]!
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

  input CreateExerciseInput {
    name: String!
    description: String
    videoUrl: String

    difficultyId: Int
    exerciseTypeId: Int
    primaryMuscleIds: [Int!]!
    secondaryMuscleIds: [Int!]
    equipmentIds: [Int!]
  }

  input UpdateExerciseInput {
    name: String
    description: String
    videoUrl: String

    difficultyId: Int
    exerciseTypeId: Int
    primaryMuscleIds: [Int!]
    secondaryMuscleIds: [Int!]
    equipmentIds: [Int!]
  }

  extend type Query {
    getMyExercises: [Exercise!]!
  }

  extend type Mutation {
    createExercise(input: CreateExerciseInput!): Exercise!
    updateExercise(id: Int!, input: UpdateExerciseInput!): Exercise!
    deleteExercise(id: Int!): Boolean!
  }
`;
