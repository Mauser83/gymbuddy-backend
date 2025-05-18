export const exerciseTypeDefs = `

  type Exercise {
    id: Int!
    name: String!
    description: String
    userId: Int!
    createdAt: String!
    updatedAt: String!

    # ➕ NEW RELATIONS
    equipments: [Equipment!]!
    workoutPlanEntries: [WorkoutPlanExercise!]!
  }

  input CreateExerciseInput {
    name: String!
    description: String

    # Optionally: allow linking equipment at creation
    equipmentIds: [Int!]
  }

  input UpdateExerciseInput {
    name: String
    description: String

    # Optionally: update equipment links
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
