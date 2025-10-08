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
    id: ID!
    equipmentId: Int!
    storageKey: String!
    sha256: String
    createdAt: String!
    updatedAt: String
    thumbUrl(ttlSec: Int = 300): String
  }

  type EquipmentSuggestionImage {
    id: ID!
    suggestionId: ID!
    storageKey: String!
    sha256: String!
    contentLength: Int!
    createdAt: String!
    thumbUrl(ttlSec: Int = 300): String
  }

  enum EquipmentSuggestionStatus {
    PENDING
    APPROVED
    REJECTED
  }

  type EquipmentSuggestion {
    id: ID!
    gymId: Int
    gym: Gym
    managerUserId: Int!
    manager: User!
    name: String!
    description: String
    brand: String!
    manualUrl: String
    categoryId: Int!
    category: EquipmentCategory!
    subcategoryId: Int
    subcategory: EquipmentSubcategory
    addToGymOnApprove: Boolean!
    status: EquipmentSuggestionStatus!
    rejectedReason: String
    approvedEquipmentId: Int
    approvedEquipment: Equipment
    images: [EquipmentSuggestionImage!]!
    createdAt: String!
    updatedAt: String!
  }

  type EquipmentUpdateSuggestion {
    id: ID!
    equipmentId: Int!
    equipment: Equipment!
    proposedName: String!
    proposedBrand: String!
    proposedManualUrl: String
    status: EquipmentSuggestionStatus!
    rejectedReason: String
    submittedByUserId: Int!
    approvedByUserId: Int
    approvedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type EquipmentSuggestionConnection {
    items: [EquipmentSuggestion!]!
    nextCursor: ID
  }

  type EquipmentUpdateSuggestionConnection {
    items: [EquipmentUpdateSuggestion!]!
    nextCursor: String
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

  input CreateEquipmentSuggestionInput {
    name: String!
    description: String
    categoryId: Int!
    subcategoryId: Int
    brand: String!
    manualUrl: String
    gymId: Int
    addToGymOnApprove: Boolean = true
  }

  input UpdateEquipmentInput {
    name: String
    description: String
    categoryId: Int
    subcategoryId: Int
    brand: String
    manualUrl: String
  }

  input ListEquipmentSuggestionsInput {
    status: EquipmentSuggestionStatus!
    gymId: Int
    categoryId: Int
    subcategoryId: Int
    limit: Int = 50
    cursor: ID
  }

  input ListEquipmentUpdateSuggestionsInput {
    status: EquipmentSuggestionStatus = PENDING
    limit: Int = 25
    cursor: String
  }

  input EquipmentSuggestionUploadTicketInput {
    suggestionId: ID!
    upload: UploadTicketInput!
  }

  input FinalizeEquipmentSuggestionImagesInput {
    suggestionId: ID!
    storageKeys: [String!]!
  }

  input ApproveEquipmentSuggestionInput {
    id: ID!
    mergeIntoEquipmentId: Int
  }

  input RejectEquipmentSuggestionInput {
    id: ID!
    reason: String
  }

  input CreateEquipmentUpdateSuggestionInput {
    equipmentId: Int!
    proposedName: String!
    proposedBrand: String!
    proposedManualUrl: String
  }

  input ApproveEquipmentUpdateSuggestionInput {
    id: ID!
  }

  input RejectEquipmentUpdateSuggestionInput {
    id: ID!
    reason: String
  }
    
  type CreateEquipmentSuggestionPayload {
    suggestion: EquipmentSuggestion!
    nearMatches: [Equipment!]!
  }

  type CreateEquipmentUpdateSuggestionPayload {
    suggestion: EquipmentUpdateSuggestion!
  }

  type ApproveEquipmentSuggestionPayload {
    approved: Boolean!
    equipmentId: Int!
  }

  type ApproveEquipmentUpdateSuggestionPayload {
    approved: Boolean!
    equipmentId: Int!
  }

  type RejectEquipmentSuggestionPayload {
    rejected: Boolean!
  }

  type RejectEquipmentUpdateSuggestionPayload {
    rejected: Boolean!
  }

  input UploadEquipmentImageInput {
    equipmentId: Int!
    storageKey: String!
    sha256: String
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
    equipmentImagesByEquipmentId(equipmentId: Int!): [EquipmentImage!]!
    equipmentImage(id: ID!): EquipmentImage

    listEquipmentSuggestions(input: ListEquipmentSuggestionsInput!): EquipmentSuggestionConnection!
    listEquipmentUpdateSuggestions(
      input: ListEquipmentUpdateSuggestionsInput!
    ): EquipmentUpdateSuggestionConnection!
  }

  extend type Mutation {
    createEquipment(input: CreateEquipmentInput!): Equipment!
    updateEquipment(id: Int!, input: UpdateEquipmentInput!): Equipment!
    deleteEquipment(id: Int!): Boolean!

    uploadEquipmentImage(input: UploadEquipmentImageInput!): EquipmentImage!
    deleteEquipmentImage(imageId: ID!): Boolean!

    createEquipmentCategory(input: CreateEquipmentCategoryInput!): EquipmentCategory!
    updateEquipmentCategory(id: Int!, input: UpdateEquipmentCategoryInput!): EquipmentCategory!
    deleteEquipmentCategory(id: Int!): Boolean!

    createEquipmentSubcategory(input: CreateEquipmentSubcategoryInput!): EquipmentSubcategory!
    updateEquipmentSubcategory(id: Int!, input: UpdateEquipmentSubcategoryInput!): EquipmentSubcategory!
    deleteEquipmentSubcategory(id: Int!): Boolean!

    createEquipmentSuggestion(input: CreateEquipmentSuggestionInput!): CreateEquipmentSuggestionPayload!
    createEquipmentSuggestionUploadTicket(input: EquipmentSuggestionUploadTicketInput!): UploadTicket!
    finalizeEquipmentSuggestionImages(input: FinalizeEquipmentSuggestionImagesInput!): [EquipmentSuggestionImage!]!
    approveEquipmentSuggestion(input: ApproveEquipmentSuggestionInput!): ApproveEquipmentSuggestionPayload!
    rejectEquipmentSuggestion(input: RejectEquipmentSuggestionInput!): RejectEquipmentSuggestionPayload!
    createEquipmentUpdateSuggestion(input: CreateEquipmentUpdateSuggestionInput!): CreateEquipmentUpdateSuggestionPayload!
    approveEquipmentUpdateSuggestion(input: ApproveEquipmentUpdateSuggestionInput!): ApproveEquipmentUpdateSuggestionPayload!
    rejectEquipmentUpdateSuggestion(input: RejectEquipmentUpdateSuggestionInput!): RejectEquipmentUpdateSuggestionPayload!
  }
`;
