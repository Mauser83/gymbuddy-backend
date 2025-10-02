-- CreateEnum
CREATE TYPE "ExerciseSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExerciseSuggestion" (
    "id" TEXT NOT NULL,
    "managerUserId" INTEGER NOT NULL,
    "gymId" INTEGER,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "videoUrl" VARCHAR(300),
    "difficultyId" INTEGER NOT NULL,
    "exerciseTypeId" INTEGER NOT NULL,
    "primaryMuscleIds" INTEGER[] NOT NULL,
    "secondaryMuscleIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "equipmentSlots" JSONB NOT NULL,
    "status" "ExerciseSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedExerciseId" INTEGER,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseSuggestion_status_createdAt_idx" ON "ExerciseSuggestion"("status", "createdAt" DESC);
CREATE INDEX "ExerciseSuggestion_gymId_status_idx" ON "ExerciseSuggestion"("gymId", "status");
CREATE INDEX "ExerciseSuggestion_managerUserId_status_idx" ON "ExerciseSuggestion"("managerUserId", "status");

-- AddForeignKey
ALTER TABLE "ExerciseSuggestion" ADD CONSTRAINT "ExerciseSuggestion_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExerciseSuggestion" ADD CONSTRAINT "ExerciseSuggestion_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExerciseSuggestion" ADD CONSTRAINT "ExerciseSuggestion_difficultyId_fkey" FOREIGN KEY ("difficultyId") REFERENCES "ExerciseDifficulty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExerciseSuggestion" ADD CONSTRAINT "ExerciseSuggestion_exerciseTypeId_fkey" FOREIGN KEY ("exerciseTypeId") REFERENCES "ExerciseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExerciseSuggestion" ADD CONSTRAINT "ExerciseSuggestion_approvedExerciseId_fkey" FOREIGN KEY ("approvedExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;