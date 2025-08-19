# Frontend Module Integration Guide

This document describes how the frontend can interact with backend modules responsible for computer vision (CV), image management, media uploads, worker coordination, and the equipment image system.

## Media: Getting an Image Upload URL

Use the `getImageUploadUrl` mutation to obtain a pre-signed URL for direct uploads to Cloudflare R2. Provide the target `gymId` and the image `contentType`; optional fields include `filename` and a custom TTL.

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

## Media: Fetching a Temporary View URL

To display an uploaded image, request a short‑lived URL from the backend.

```graphql
query ImageUrl($storageKey: String!, $ttlSec: Int = 600) {
  imageUrl(storageKey: $storageKey, ttlSec: $ttlSec) {
    url
    expiresAt
  }
}
```
**Variables**
```json
{ "storageKey": "uploads/123.jpg", "ttlSec": 900 }
```

## Images: Finalizing and Moderating Uploads

After uploading the file, call `finalizeGymImage` to link the upload to a gym and equipment item. The mutation returns the stored record and a list of queued background jobs.

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
    "storageKey": "uploads/123.jpg",
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
- `approveGymImage`
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

`GymEquipmentImage` records are tied to a specific gym's piece of equipment while `EquipmentImage` records represent globally approved training images. Use the following helpers:

- Upload an image for global equipment assets:
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
      "storageKey": "uploads/123.jpg",
      "sha256": "<hex>"
    }
  }
  ```
- List or delete equipment images:
  - `equipmentImagesByEquipmentId(equipmentId: Int!)`
  - `equipmentImage(id: ID!)`
  - `deleteEquipmentImage(imageId: ID!)`
- Upload an image tied to a gym's equipment:
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
      "storageKey": "uploads/123.jpg",
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
input KnnSearchInput {
  imageId: ID
  vector: [Float!]
  scope: String!  # "GLOBAL" | "GYM"
  limit: Int = 10
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

## Typical Upload Flow

1. Call `getImageUploadUrl` and upload the file to the returned URL.
2. Invoke `finalizeGymImage` with the returned `storageKey` and any taxonomy identifiers.
3. Moderators review images, promoting approved ones to global equipment assets.
4. Background workers process queued jobs; UIs may call `knnSearch` or `taxonomyTypes` to surface similar images and metadata-driven filters.
