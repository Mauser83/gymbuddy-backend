-- AlterTable
ALTER TABLE "TrainingCandidate"
  ADD COLUMN "safetyReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "capturedAt" TIMESTAMP(3),
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "embedding" vector(512);