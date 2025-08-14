-- Drop old tables if present
DROP TABLE IF EXISTS "GymEquipmentImage";
DROP TABLE IF EXISTS "EquipmentImage";

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable EquipmentImage
CREATE TABLE "EquipmentImage" (
    "id" TEXT NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "gymEquipmentId" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EquipmentImage_sha256_key" ON "EquipmentImage"("sha256");
CREATE INDEX "EquipmentImage_equipmentId_createdAt_idx" ON "EquipmentImage"("equipmentId","createdAt");
CREATE INDEX "EquipmentImage_uploadedByUserId_idx" ON "EquipmentImage"("uploadedByUserId");

-- CreateTable GymEquipmentImage
CREATE TABLE "GymEquipmentImage" (
    "id" TEXT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "gymEquipmentId" INTEGER NOT NULL,
    "imageId" TEXT NOT NULL,
    "capturedByUserId" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymEquipmentImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "EquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "GymEquipmentImage_gymId_equipmentId_idx" ON "GymEquipmentImage"("gymId","equipmentId");
CREATE INDEX "GymEquipmentImage_imageId_idx" ON "GymEquipmentImage"("imageId");
CREATE INDEX "GymEquipmentImage_gymEquipmentId_idx" ON "GymEquipmentImage"("gymEquipmentId");
CREATE UNIQUE INDEX "GymEquipmentImage_gymId_equipmentId_imageId_key" ON "GymEquipmentImage"("gymId","equipmentId","imageId");

-- CreateTable ImageEmbedding
CREATE TABLE "ImageEmbedding" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "modelVendor" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "embeddingVec" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageEmbedding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImageEmbedding" ADD CONSTRAINT "ImageEmbedding_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "EquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ImageEmbedding_imageId_scope_modelVendor_modelName_modelVersion_key" ON "ImageEmbedding"("imageId","scope","modelVendor","modelName","modelVersion");
CREATE INDEX "ImageEmbedding_scope_modelVendor_modelName_modelVersion_idx" ON "ImageEmbedding"("scope","modelVendor","modelName","modelVersion");
CREATE INDEX "ImageEmbedding_createdAt_idx" ON "ImageEmbedding"("createdAt");

-- CreateEnum ImageJobStatus
CREATE TYPE "ImageJobStatus" AS ENUM ('pending', 'processing', 'succeeded', 'failed');

-- CreateTable ImageQueue
CREATE TABLE "ImageQueue" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "ImageJobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageQueue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImageQueue" ADD CONSTRAINT "ImageQueue_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "EquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ImageQueue_status_priority_scheduledAt_idx" ON "ImageQueue"("status","priority","scheduledAt");
CREATE INDEX "ImageQueue_jobType_status_idx" ON "ImageQueue"("jobType","status");
CREATE INDEX "ImageQueue_imageId_idx" ON "ImageQueue"("imageId");