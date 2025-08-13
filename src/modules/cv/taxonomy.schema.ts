export const taxonomyTypeDefs = `
  extend type Query {
    angleTypes(active: Boolean = true): [AngleType!]!
    heightTypes(active: Boolean = true): [HeightType!]!
    lightingTypes(active: Boolean = true): [LightingType!]!
    mirrorTypes(active: Boolean = true): [MirrorType!]!
    distanceTypes(active: Boolean = true): [DistanceType!]!
    sourceTypes(active: Boolean = true): [SourceType!]!
    splitTypes(active: Boolean = true): [SplitType!]!
  }

  type AngleType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type HeightType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type LightingType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type MirrorType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type DistanceType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type SourceType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }

  type SplitType {
    id: Int!
    key: String!
    label: String!
    description: String
    active: Boolean!
    displayOrder: Int!
  }
`;