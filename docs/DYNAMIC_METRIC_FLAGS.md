# Dynamic Metric Flags

This update adds new flexibility for how metrics behave in planning and input forms. `Metric` entries can now be configured entirely through the admin UI and GraphQL without code changes.

## Schema Changes

- **Prisma**: Added two boolean fields to `Metric`:
  - `useInPlanning` – determines if the metric is used by plan-building logic (defaults to `true`).
  - `minOnly` – if `true`, only a minimum value is expected instead of a min/max pair (defaults to `false`).

```prisma
model Metric {
  id            Int                  @id @default(autoincrement())
  name          String
  slug          String               @unique
  unit          String
  inputType     String
  useInPlanning Boolean              @default(true)
  minOnly       Boolean              @default(false)
  exerciseTypes ExerciseTypeMetric[]
}
```

## GraphQL API

`Metric` type and input objects expose the new fields:

```graphql
type Metric {
  id: Int!
  name: String!
  slug: String!
  unit: String!
  inputType: String!
  useInPlanning: Boolean!
  minOnly: Boolean!
}

input UpdateMetricInput {
  name: String
  slug: String
  unit: String
  inputType: String
  useInPlanning: Boolean
  minOnly: Boolean
}
```

Queries like `allMetrics` now return `useInPlanning` and `minOnly` for each metric.

## TypeScript Updates

DTOs and interfaces include the new properties so that the frontend receives and can send them when updating metrics.

```ts
export class UpdateMetricDto {
  name?: string;
  slug?: string;
  unit?: string;
  inputType?: string;
  useInPlanning?: boolean;
  minOnly?: boolean;
}

export interface Metric {
  id: number;
  name: string;
  slug: string;
  unit: string;
  inputType: string;
  useInPlanning: boolean;
  minOnly: boolean;
}
```

## Usage

- Administrators can toggle `useInPlanning` to hide certain metrics from automatic plan calculations.
- Setting `minOnly` simplifies input forms for metrics where only a minimum value is needed.
- New metrics can be created through the existing `createMetric` mutation with these flags as desired.
