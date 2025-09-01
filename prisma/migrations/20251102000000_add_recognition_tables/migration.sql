-- CreateTable
CREATE TABLE "RecognitionAttempt" (
    "id" BIGSERIAL PRIMARY KEY,
    "gymId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "vectorHash" TEXT NOT NULL,
    "bestEquipmentId" INTEGER,
    "bestScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "consent" TEXT NOT NULL DEFAULT 'unknown'
);

-- CreateTable
CREATE TABLE "TrainingCandidate" (
    "id" BIGSERIAL PRIMARY KEY,
    "attemptId" BIGINT NOT NULL,
    "gymId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "TrainingCandidate_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "RecognitionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);