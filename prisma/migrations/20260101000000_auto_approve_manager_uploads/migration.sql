-- Add gym settings
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "autoApproveManagerUploads" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Gym" ADD COLUMN IF NOT EXISTS "requireHumanReviewForPersons" BOOLEAN NOT NULL DEFAULT true;

-- Drop old training tables if they exist
DROP TABLE IF EXISTS "TrainingCandidate" CASCADE;

-- Enums
DO $$ BEGIN
  CREATE TYPE "TrainingSource" AS ENUM ('gym_equipment','admin','user_submission');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TrainingStatus" AS ENUM ('pending','approved','quarantined','rejected','failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create TrainingCandidate table
CREATE TABLE "TrainingCandidate" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "storageKey" TEXT NOT NULL,
  "imageId" TEXT,
  "gymEquipmentId" INT,
  "gymId" INT,
  "uploaderUserId" INT,
  "source" "TrainingSource" NOT NULL DEFAULT 'gym_equipment',
  "status" "TrainingStatus" NOT NULL DEFAULT 'pending',
  "hash" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "TrainingCandidate_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GymEquipmentImage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TrainingCandidate_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TrainingCandidate_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TrainingCandidate_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainingCandidate_status_idx" ON "TrainingCandidate"("status");
CREATE INDEX IF NOT EXISTS "TrainingCandidate_hash_idx" ON "TrainingCandidate"("hash");