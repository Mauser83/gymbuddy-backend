export const equipmentTypeDefs = `
  type Equipment {
    id: Int!
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
    id: Int!
    name: String!
    slug: String!
    subcategories: [EquipmentSubcategory!]!
  }

  type EquipmentSubcategory {
    id: Int!
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
    equipment(id: Int!): Equipment
    allEquipments(search: String): [Equipment]
    equipmentCategories: [EquipmentCategory!]!
    equipmentSubcategories(categoryId: ID): [EquipmentSubcategory!]!
  }

  extend type Mutation {
    createEquipment(input: CreateEquipmentInput!): Equipment!
    updateEquipment(id: Int!, input: UpdateEquipmentInput!): Equipment!
    deleteEquipment(id: Int!): Boolean!

    createEquipmentCategory(input: CreateEquipmentCategoryInput!): EquipmentCategory!
    updateEquipmentCategory(id: Int!, input: UpdateEquipmentCategoryInput!): EquipmentCategory!
    deleteEquipmentCategory(id: Int!): Boolean!

    createEquipmentSubcategory(input: CreateEquipmentSubcategoryInput!): EquipmentSubcategory!
    updateEquipmentSubcategory(id: Int!, input: UpdateEquipmentSubcategoryInput!): EquipmentSubcategory!
    deleteEquipmentSubcategory(id: Int!): Boolean!
  }
`;
