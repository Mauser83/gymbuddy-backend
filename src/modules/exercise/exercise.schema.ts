export const exerciseTypeDefs = `
  type Exercise {
    id: ID!
    name: String!
    description: String
    sets: Int
    reps: Int
    weight: Float
    equipmentId: Int
    userId: Int!
    createdAt: String!
    updatedAt: String!
  }

  input CreateExerciseInput {
    name: String!
    description: String
    sets: Int
    reps: Int
    weight: Float
    equipmentId: Int
  }

  input UpdateExerciseInput {
    name: String
    description: String
    sets: Int
    reps: Int
    weight: Float
    equipmentId: Int
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
