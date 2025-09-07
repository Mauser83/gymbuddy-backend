ALTER TABLE "TrainingCandidate"
  ADD COLUMN "recognitionScoreAtCapture" DOUBLE PRECISION,
  ADD COLUMN "isSafe" BOOLEAN,
  ADD COLUMN "nsfwScore" DOUBLE PRECISION,
  ADD COLUMN "hasPerson" BOOLEAN,
  ADD COLUMN "personCount" INTEGER,
  ADD COLUMN "personBoxes" JSONB,
  ADD COLUMN "embeddingModelVendor" TEXT,
  ADD COLUMN "embeddingModelName" TEXT,
  ADD COLUMN "embeddingModelVersion" TEXT;