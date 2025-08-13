export const taxonomyTypeDefs = `
  enum TaxonomyKind { ANGLE HEIGHT LIGHTING MIRROR DISTANCE SOURCE SPLIT }

  type TaxonomyType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
    kind: TaxonomyKind!
  }

  input CreateTaxonomyInput {
    key: String!
    label: String!
    description: String
    active: Boolean = true
    displayOrder: Int = 0
  }

  input UpdateTaxonomyInput {
    key: String
    label: String
    description: String
    active: Boolean
    displayOrder: Int
  }

  input ReorderTaxonomyItemInput {
    id: Int!
    displayOrder: Int!
  }

  extend type Query {
    taxonomyTypes(kind: TaxonomyKind!, active: Boolean = true): [TaxonomyType!]!
    taxonomyType(kind: TaxonomyKind!, id: Int!): TaxonomyType
  }

  extend type Mutation {
    createTaxonomyType(kind: TaxonomyKind!, input: CreateTaxonomyInput!): TaxonomyType!
    updateTaxonomyType(kind: TaxonomyKind!, id: Int!, input: UpdateTaxonomyInput!): TaxonomyType!
    setTaxonomyActive(kind: TaxonomyKind!, id: Int!, active: Boolean!): TaxonomyType!
    deleteTaxonomyType(kind: TaxonomyKind!, id: Int!): Boolean!
    reorderTaxonomyTypes(kind: TaxonomyKind!, items: [ReorderTaxonomyItemInput!]!): [TaxonomyType!]!
  }
`;