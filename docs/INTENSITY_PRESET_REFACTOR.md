# Intensity Preset Refactor

This update introduces per-metric defaults for intensity presets. Instead of storing fixed fields for reps, RPE, rest, or sets, each preset now defines a list of metric defaults. This improves flexibility for new metrics such as time or distance.

## Schema Changes

- **Prisma**: Added a new `IntensityMetricDefault` model and removed the old preset fields.
- Each `IntensityPreset` now has a `metricDefaults` relation to many `IntensityMetricDefault` entries.

```prisma
model IntensityPreset {
  id                Int      @id @default(autoincrement())
  trainingGoalId    Int
  experienceLevelId Int
  metricDefaults    IntensityMetricDefault[]
  trainingGoal      TrainingGoal    @relation(fields: [trainingGoalId], references: [id])
  experienceLevel   ExperienceLevel @relation(fields: [experienceLevelId], references: [id])
}

model IntensityMetricDefault {
  id         Int             @id @default(autoincrement())
  metricId   Int
  defaultMin Float
  defaultMax Float?
  preset     IntensityPreset @relation(fields: [presetId], references: [id])
  presetId   Int
}
```

## GraphQL API

- New type `IntensityMetricDefault` and updated `IntensityPreset` type to expose `metricDefaults`.
- Inputs for creating and updating presets now accept an array of metric defaults.

```graphql
type IntensityMetricDefault {
  metricId: Int!
  defaultMin: Float!
  defaultMax: Float
}

type IntensityPreset {
  id: Int!
  trainingGoalId: Int!
  experienceLevelId: Int!
  metricDefaults: [IntensityMetricDefault!]!
}

input IntensityMetricDefaultInput {
  metricId: Int!
  defaultMin: Float!
  defaultMax: Float
}

input IntensityPresetInput {
  trainingGoalId: Int!
  experienceLevelId: ID!
  metricDefaults: [IntensityMetricDefaultInput!]!
}
```

## DTO Updates

`CreateIntensityPresetDto` and `UpdateIntensityPresetDto` now validate a `metricDefaults` array using the new `IntensityMetricDefaultInput` class.

## Service & Resolver Changes

- Preset creation uses nested `metricDefaults.create` to store defaults.
- Updating a preset wraps operations in a Prisma transaction: old defaults are deleted and new ones created.
- Query resolvers include the `metricDefaults` relation when fetching presets or training goals.

These changes enable different default metrics per training goal and experience level and set the stage for future metrics such as time or distance.