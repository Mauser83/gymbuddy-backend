-- Recreate RecognitionAttempt table dropped in previous migration
CREATE TABLE IF NOT EXISTS "RecognitionAttempt" (
    "id" BIGSERIAL PRIMARY KEY,
    "gymId" INT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "vectorHash" TEXT NOT NULL,
    "bestEquipmentId" INT,
    "bestScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "consent" TEXT NOT NULL DEFAULT 'unknown'
);