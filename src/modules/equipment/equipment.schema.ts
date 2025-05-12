export const equipmentTypeDefs = `
  type Equipment {
    id: ID!
    name: String!
    description: String
    category: EquipmentCategory!
    categoryId: Int!
    subcategory: EquipmentSubcategory
    subcategoryId: Int
    brand: String!
    manualUrl: String
    gymId: Int
    gym: Gym
    createdAt: String!
    updatedAt: String!
    deletedAt: String
  }

  type EquipmentCategory {
    id: ID!
    name: String!
    slug: String!
    subcategories: [EquipmentSubcategory!]!
  }

  type EquipmentSubcategory {
    id: ID!
    name: String!
    slug: String!
    category: EquipmentCategory!
    categoryId: Int!
  }

  input CreateEquipmentInput {
    name: String!
    description: String
    categoryId: Int!
    subcategoryId: Int
    brand: String!
    manualUrl: String
    gymId: Int
  }

  input UpdateEquipmentInput {
    name: String
    description: String
    categoryId: Int
    subcategoryId: Int
    brand: String
    manualUrl: String
    gymId: Int
  }

  input CreateEquipmentCategoryInput {
    name: String!
    slug: String!
  }

  input CreateEquipmentSubcategoryInput {
    name: String!
    slug: String!
    categoryId: Int!
  }

  input UpdateEquipmentCategoryInput {
    name: String!
    slug: String!
  }

  input UpdateEquipmentSubcategoryInput {
    name: String!
    slug: String!
  }

  extend type Query {
    equipment(id: ID!): Equipment
    allEquipments(search: String): [Equipment]
    equipmentCategories: [EquipmentCategory!]!
    equipmentSubcategories(categoryId: Int): [EquipmentSubcategory!]!
  }

  extend type Mutation {
    createEquipment(input: CreateEquipmentInput!): Equipment!
    updateEquipment(id: ID!, input: UpdateEquipmentInput!): Equipment!
    deleteEquipment(id: ID!): Boolean!

    createEquipmentCategory(input: CreateEquipmentCategoryInput!): EquipmentCategory!
    updateEquipmentCategory(id: ID!, input: UpdateEquipmentCategoryInput!): EquipmentCategory!
    deleteEquipmentCategory(id: ID!): Boolean!

    createEquipmentSubcategory(input: CreateEquipmentSubcategoryInput!): EquipmentSubcategory!
    updateEquipmentSubcategory(id: ID!, input: UpdateEquipmentSubcategoryInput!): EquipmentSubcategory!
    deleteEquipmentSubcategory(id: ID!): Boolean!
  }
`;
