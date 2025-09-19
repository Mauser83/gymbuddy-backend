# Experience Level Model Refactor

This backend update replaces the old `ExperienceLevel` enum with a full database model using an auto‑incrementing integer ID.

## Schema changes

- **Prisma**: new `ExperienceLevel` model

  ```prisma
  model ExperienceLevel {
    id        Int      @id @default(autoincrement())
    name      String   @unique
    key       String   @unique
    isDefault Boolean  @default(false)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    WorkoutPlans WorkoutPlan[]
  }
  ```

- `WorkoutPlan` and `IntensityPreset` now reference `experienceLevelId` (Int).
- The obsolete `order` field was removed.

## GraphQL API

- Enum `ExperienceLevel` removed.
- Added `type ExperienceLevel` with the fields shown above.
- New queries and mutations:

  ```graphql
  extend type Query {
    experienceLevels: [ExperienceLevel!]!
    experienceLevel(id: Int!): ExperienceLevel
  }

  extend type Mutation {
    createExperienceLevel(input: CreateExperienceLevelInput!): ExperienceLevel!
    updateExperienceLevel(id: Int!, input: UpdateExperienceLevelInput!): ExperienceLevel!
    deleteExperienceLevel(id: Int!): Boolean!
  }
  ```

- Inputs that previously took a string enum now accept `experienceLevelId` (Int), including workout plan, intensity preset and user preference mutations.

## TypeScript updates

- DTOs and interfaces changed to use numeric IDs.
- Services and resolvers updated to create and fetch experience levels via Prisma.

## Seed data

`prisma/seed.ts` inserts default levels (`Beginner`, `Intermediate`, `Advanced`) with `isDefault` flags.

These changes keep all experience level logic within the workoutplan module and remove
