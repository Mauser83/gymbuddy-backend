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
    createdAt: String!
    updatedAt: String!
    deletedAt: String
    images: [EquipmentImage!]!

    # ✅ NEW: Exercises that use this equipment's subcategory
    compatibleExercises: [Exercise!]!
  }

  type EquipmentImage {
    id: Int!
    equipmentId: Int!
    url: String!
    createdAt: String!
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
  }

  input UpdateEquipmentInput {
    name: String
    description: String
    categoryId: Int
    subcategoryId: Int
    brand: String
    manualUrl: String
  }

  input UploadEquipmentImageInput {
    equipmentId: Int!
    url: String!
  }

  input CreateEquipmentCategoryInput {
    name: String!
    slug: String!
  }

  input UpdateEquipmentCategoryInput {
    name: String!
    slug: String!
  }

  input CreateEquipmentSubcategoryInput {
    name: String!
    slug: String!
    categoryId: Int!
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

    gymEquipmentByGymId(gymId: Int!): [GymEquipment!]!
  }

  extend type Mutation {
    createEquipment(input: CreateEquipmentInput!): Equipment!
    updateEquipment(id: Int!, input: UpdateEquipmentInput!): Equipment!
    deleteEquipment(id: Int!): Boolean!

    uploadEquipmentImage(input: UploadEquipmentImageInput!): EquipmentImage!
    deleteEquipmentImage(imageId: Int!): Boolean!

    createEquipmentCategory(input: CreateEquipmentCategoryInput!): EquipmentCategory!
    updateEquipmentCategory(id: Int!, input: UpdateEquipmentCategoryInput!): EquipmentCategory!
    deleteEquipmentCategory(id: Int!): Boolean!

    createEquipmentSubcategory(input: CreateEquipmentSubcategoryInput!): EquipmentSubcategory!
    updateEquipmentSubcategory(id: Int!, input: UpdateEquipmentSubcategoryInput!): EquipmentSubcategory!
    deleteEquipmentSubcategory(id: Int!): Boolean!
  }
`;
