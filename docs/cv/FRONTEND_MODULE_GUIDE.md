# Frontend Module Integration Guide

This document describes how the frontend can interact with backend modules responsible for computer vision (CV), image management, media uploads, worker coordination, and the equipment image system.

## Upload flow overview

- **Mobile batch (preferred)**: `createUploadSession` → PUTs → `finalizeGymImages` → `applyTaxonomiesToGymImages`.
- **Admin batch**: `createUploadSession` → PUTs → `finalizeGymImagesAdmin` → `applyTaxonomiesToGymImages`.
- **Single file (legacy)**: `getImageUploadUrl` → PUT → `finalizeGymImage`.

The single-file path remains supported, but batch uploads are recommended for mobile.

## Storage & keys

Uploads use the prefix `private/uploads/<gymId>/<YYYY>/<MM>/<uuid>.<ext>` (UTC with zero‑padded months).
Objects under `private/uploads` auto-expire after 30 days.
`public/golden` assets retain indefinitely, and `public/training` assets retain for 12 months.

## Uploads

Accepted types: `image/*`  
Max size: \u2264 15 MB per image.

### Session-oriented batch capture

**GraphQL schema**
```graphql
input CreateUploadSessionInput {
  gymId: Int!
  count: Int!                 # 1..10
  contentTypes: [String!]!    # e.g. ["image/jpeg","image/heic",...], len == count
  filenamePrefix: String
  equipmentId: Int            # optional hint for finalize defaults
}

type HttpHeader { name: String!, value: String! }
type PresignItem {
  url: String!
  storageKey: String!
  expiresAt: String!
  requiredHeaders: [HttpHeader!]!
}

type CreateUploadSessionPayload {
  sessionId: ID!
  items: [PresignItem!]!
  expiresAt: String!          # session TTL (e.g., 30–60 min)
}

extend type Mutation {
  createUploadSession(input: CreateUploadSessionInput!): CreateUploadSessionPayload!
}
```

**Behavior**

Auth: admin or gym-admin for the same `gymId`.

Generates `count` keys under `private/uploads/<gymId>/<YYYY>/<MM>/<uuid>.<ext>`.

Presigns PUT URLs (10–15 min). Unused URLs simply expire.

Optional: persist an UploadSession for audit; otherwise return ephemeral `sessionId`.

**Validation**

1 ≤ `count` ≤ 10; all `contentTypes` start with `image/`.

**Example**

```graphql
mutation CreateUploadSession($input: CreateUploadSessionInput!) {
  createUploadSession(input: $input) {
    sessionId
    items { url storageKey expiresAt requiredHeaders { name value } }
    expiresAt
  }
}
```
```json
{
  "input": {
    "gymId": 12,
    "count": 6,
    "contentTypes": ["image/jpeg","image/jpeg","image/heic","image/jpeg","image/jpeg","image/jpeg"],
    "filenamePrefix": "legpress-session",
    "equipmentId": 101
  }
}
```
```json
{
  "data": {
    "createUploadSession": {
      "sessionId": "sess_abc123",
      "items": [
        { "url": "...", "storageKey": "private/uploads/12/2025/08/uuid1.jpg" }
      ]
    }
  }
}
```

### Uploading to presigned URLs

```ts
await fetch(url, { method: "PUT", headers, body: fileBlob });
```

### Finalizing many images

```graphql
input GymImageDefaults {
  gymId: Int!
  equipmentId: Int!
  sourceId: Int
  splitId: Int
  lightingId: Int
}

input FinalizeGymImageItem {
  storageKey: String!
  sha256: String
  angleId: Int
  heightId: Int
  distanceId: Int
  mirrorId: Int
  lightingId: Int
  splitId: Int
  sourceId: Int
}

input FinalizeGymImagesInput {
  sessionId: ID
  defaults: GymImageDefaults!
  items: [FinalizeGymImageItem!]!   # 1..10
}

type FinalizeManyPayload {
  images: [GymEquipmentImage!]!
  queuedJobs: Int!
}

extend type Mutation {
  finalizeGymImages(input: FinalizeGymImagesInput!): FinalizeManyPayload!
  finalizeGymImagesAdmin(input: FinalizeGymImagesInput!): FinalizeManyPayload!
}
```

**Behavior**

Auth: `finalizeGymImagesAdmin` requires app admin; regular users call `finalizeGymImages` for their own uploads.

For each item:

- Reject if `storageKey` is outside `private/uploads/<gymId>/`.
- HEAD the object (size/type); 404 → error.
- Create `GymEquipmentImage` (status=PENDING), copy defaults, apply per-item overrides.
- Enqueue HASH (if `sha256` missing), SAFETY, EMBED.

Idempotent by `storageKey` (and by `sha256` if you enforce uniqueness).

**Example**

```graphql
mutation FinalizeGymImages($input: FinalizeGymImagesInput!) {
  finalizeGymImages(input: $input) {
    images { id gymId equipmentId status }
    queuedJobs
  }
}
```
```json
{
  "input": {
    "sessionId": "sess_abc123",
    "defaults": { "gymId": 12, "equipmentId": 101, "sourceId": 3, "splitId": 2 },
    "items": [
      { "storageKey": "private/uploads/12/2025/08/uuid1.jpg" },
      { "storageKey": "private/uploads/12/2025/08/uuid2.jpg" }
    ]
  }
}
```
```json
{
  "data": {
    "finalizeGymImages": {
      "images": [
        { "id": 1, "equipmentId": 101, "status": "PENDING" },
        { "id": 2, "equipmentId": 101, "status": "PENDING" }
      ],
      "queuedJobs": 2
    }
  }
}
```

### Bulk taxonomy apply (post-capture tagging)

```graphql
input ApplyTaxonomiesInput {
  imageIds: [ID!]!
  angleId: Int
  heightId: Int
  distanceId: Int
  lightingId: Int
  mirrorId: Int
  splitId: Int
  sourceId: Int
}
type ApplyTaxonomiesPayload { updatedCount: Int! }

extend type Mutation {
  applyTaxonomiesToGymImages(input: ApplyTaxonomiesInput!): ApplyTaxonomiesPayload!
}
```

**Behavior**

Auth: admin or gym-admin for the owning gym.

Applies non-null fields to all `imageIds`.

**Example**

```graphql
mutation ApplyTaxonomies($input: ApplyTaxonomiesInput!) {
  applyTaxonomiesToGymImages(input: $input) { updatedCount }
}
```
```json
{ "input": { "imageIds": [1,2], "angleId": 3 } }
```
```json
{ "data": { "applyTaxonomiesToGymImages": { "updatedCount": 2 } } }
```

### Batch presigned GET (fast grids)

```graphql
type ImageUrlItem { storageKey: String!, url: String!, expiresAt: String! }

extend type Query {
  imageUrlMany(storageKeys: [String!]!, ttlSec: Int = 600): [ImageUrlItem!]!
}
```

**Behavior**

Auth: same as single `imageUrl` (admin or gym-admin for the owning gym). Clients should refresh URLs on 403 by re-calling `imageUrlMany`.

**Example**

```graphql
query ImageUrlMany($keys: [String!]!, $ttlSec: Int) {
  imageUrlMany(storageKeys: $keys, ttlSec: $ttlSec) { storageKey url expiresAt }
}
```
```json
{ "keys": ["public/golden/123.jpg", "public/golden/124.jpg"], "ttlSec": 600 }
```
```json
{
  "data": {
    "imageUrlMany": [
      { "storageKey": "public/golden/123.jpg", "url": "...", "expiresAt": "..." },
      { "storageKey": "public/golden/124.jpg", "url": "...", "expiresAt": "..." }
    ]
  }
}
```

For a single image:

```graphql
query ImageUrl($storageKey: String!, $ttlSec: Int = 600) {
  imageUrl(storageKey: $storageKey, ttlSec: $ttlSec) { url expiresAt }
}
```
```json
{ "storageKey": "private/uploads/12/2025/08/uuid1.jpg", "ttlSec": 900 }
```

### Single file upload (legacy)

Use the `getImageUploadUrl` mutation to obtain a pre-signed URL for direct uploads to Cloudflare R2. Provide the target `gymId` and the image `contentType`; optional fields include `filename` and a custom TTL.

Auth: admin or gym-admin for `gymId`.

**GraphQL**
```graphql
mutation GetImageUploadUrl($input: GetImageUploadUrlInput!) {
  getImageUploadUrl(input: $input) {
    url
    storageKey
    expiresAt
    requiredHeaders { name value }
  }
}
```
**Variables**
```json
{
  "input": {
    "gymId": 123,
    "contentType": "image/jpeg",
    "filename": "legpress.jpg"
  }
}
```
Send the file with an HTTP `PUT` to `url` and include the `requiredHeaders`. Store the returned `storageKey`; it is required in later steps.

## Images: Finalizing and Moderating Uploads

For legacy single uploads, call `finalizeGymImage` to link the upload to a gym and equipment item. The mutation returns the stored record and a list of queued background jobs. Batch finalization is handled by `finalizeGymImages` above.

Auth: admin or gym-admin for the owning gym.

```graphql
mutation FinalizeGymImage($input: FinalizeGymImageInput!) {
  finalizeGymImage(input: $input) {
    image { id gymId equipmentId status }
    queuedJobs
  }
}
```
**Variables**
```json
{
  "input": {
    "storageKey": "private/uploads/12/2025/08/uuid1.jpg",
    "gymId": 1,
    "equipmentId": 2,
    "sha256": "<hex>",
    "angleId": 1,
    "heightId": 2
  }
}
```
`GymEquipmentImage.status` values: `PENDING`, `APPROVED`, `REJECTED`.

Moderation operations are also available:

- `promoteGymImageToGlobal`
  ```graphql
  mutation Promote($input: PromoteGymImageInput!) {
    promoteGymImageToGlobal(input: $input) {
      equipmentImage { id }
      gymImage { id }
    }
  }
  ```
  **Variables**
  ```json
  { "input": { "id": "<gymImageId>", "splitId": 1, "force": false } }
  ```
- `approveGymImage` (routes to promotion)
  ```graphql
  mutation Approve($input: ApproveGymImageInput!) {
    approveGymImage(input: $input) {
      equipmentImage { id }
      gymImage { id }
    }
  }
  ```
  **Variables**
  ```json
  { "input": { "id": "<gymImageId>", "splitId": 1 } }
  ```
- `rejectGymImage`
  ```graphql
  mutation Reject($input: RejectGymImageInput!) {
    rejectGymImage(input: $input) {
      gymImage { id status }
    }
  }
  ```
  **Variables**
  ```json
  { "input": { "id": "<gymImageId>", "reason": "blurry", "deleteObject": false } }
  ```
- `candidateGlobalImages`
  ```graphql
  query Candidates($input: CandidateGlobalImagesInput!) {
      candidateGlobalImages(input: $input) {
        id
        gymId
        equipmentId
        status
        storageKey
        sha256
      }
    }
    ```
  **Variables**
  ```json
  { "input": { "equipmentId": 2, "limit": 50 } }
  ```

## Gym & Equipment Image Management

Legacy/admin-internal endpoints. Prefer the batch session + finalize path and the approve/promote flow above.

`GymEquipmentImage` records are tied to a specific gym's piece of equipment while `EquipmentImage` records represent globally approved training images. Use the following helpers:

- **Legacy/admin-internal (admin only):** Upload an image for global equipment assets:
  ```graphql
  mutation UploadEquipmentImage($input: UploadEquipmentImageInput!) {
    uploadEquipmentImage(input: $input) {
      id
      storageKey
      thumbUrl
    }
  }
  ```
  **Variables**
  ```json
  {
    "input": {
      "equipmentId": 2,
      "storageKey": "private/uploads/12/2025/08/uuid1.jpg",
      "sha256": "<hex>"
    }
  }
  ```
- List or delete equipment images:
  - `equipmentImagesByEquipmentId(equipmentId: Int!)`
  - `equipmentImage(id: ID!)`
  - `deleteEquipmentImage(imageId: ID!)`
- **Legacy/admin-internal (admin only):** Upload an image tied to a gym's equipment:
  ```graphql
  mutation UploadGymImage($input: UploadGymImageInput!) {
    uploadGymImage(input: $input) {
      id
      equipmentId
      status
    }
  }
  ```
  **Variables**
  ```json
  {
    "input": {
      "gymId": 1,
      "equipmentId": 2,
      "storageKey": "private/uploads/12/2025/08/uuid1.jpg",
      "sha256": "<hex>",
      "status": "PENDING"
    }
  }
  ```
- List or delete gym images:
  - `gymImagesByGymId(gymId: Int!)`
  - `gymImage(id: ID!)`
  - `deleteGymImage(imageId: ID!)`

## CV: Search and Taxonomy Helpers

The CV module exposes utilities for image search and metadata taxonomy.

```graphql
enum KnnScope {
  GLOBAL
  GYM
}

input KnnSearchInput {
  imageId: ID!
  scope: KnnScope!
  limit: Int = 10
  gymId: Int
}

query Knn($input: KnnSearchInput!) {
  knnSearch(input: $input) {
    imageId
    equipmentId
    score
    storageKey
  }
}
```
**Variables**
```json
{ "input": { "imageId": "<equipmentImageId>", "scope": "GLOBAL", "limit": 5 } }
```

```graphql
query {
  taxonomyTypes {
    angles { id name }
    heights { id name }
    distances { id name }
    lighting { id name }
  }
}
```

Admin CRUD for taxonomy tables:

```graphql
mutation CreateAngle($name: String!) {
  createAngle(name: $name) { id name active }
}
mutation UpdateAngle($id: Int!, $name: String!, $active: Boolean) {
  updateAngle(id: $id, name: $name, active: $active) { id name active }
}
```

Advanced operations for embeddings and image-processing queues exist (`imageEmbeddings`, `enqueueImageJob`, etc.) but are typically used by internal workers or admin tooling.

## Worker: Triggering Background Processing

Query the image processing queue and retry failed jobs when necessary:

```graphql
query ImageQueue($status: String, $jobType: String, $limit: Int = 100) {
  imageQueue(status: $status, jobType: $jobType, limit: $limit) {
    id
    imageId
    jobType
    status
    attempts
    scheduledAt
    error
  }
}
mutation RetryJob($id: ID!) {
  retryImageJob(id: $id)
}
mutation RetryJobs($imageId: ID!) {
  retryImageJobs(imageId: $imageId)
}
```
`ImageQueue.status` values: `PENDING`, `RUNNING`, `DONE`, `FAILED`. Typical `jobType` values include `HASH`, `SAFETY`, `EMBED`.

Admins and moderators can invoke `runImageWorkerOnce` to process pending image jobs. The optional `max` argument limits how many queued tasks the worker should handle in this run.

```graphql
mutation RunImageWorkerOnce($max: Int) {
  runImageWorkerOnce(max: $max)
}
```
**Variables**
```json
{ "max": 50 }
```

## Error model & limits

| Condition | Status |
| --- | --- |
| count > 10 | 400 |
| contentTypes length mismatch | 400 |
| Non `image/*` content type | 400 |
| Finalize key outside caller’s gymId | 403 |
| Missing uploaded object on finalize | 404 |
| Batch size too large (server guard) | 413 |

## Testing checklist (backend)

- Session generates keys under correct prefix & month.
- Finalize many creates N rows, enqueues N× jobs.
- Idempotency: duplicate `storageKey` finalize → single row.
- Bulk apply updates `updatedCount` correctly.
- `imageUrlMany` returns signed URLs that expire as expected.