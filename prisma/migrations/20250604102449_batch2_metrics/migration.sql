/*
  Warnings:

  - You are about to drop the column `reps` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `rpe` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `targetReps` on the `WorkoutPlanExercise` table. All the data in the column will be lost.
  - You are about to drop the column `targetRpe` on the `WorkoutPlanExercise` table. All the data in the column will be lost.
  - You are about to drop the column `targetWeight` on the `WorkoutPlanExercise` table. All the data in the column will be lost.
  - Made the column `exerciseTypeId` on table `Exercise` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `metrics` to the `ExerciseLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetMetrics` to the `WorkoutPlanExercise` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_exerciseTypeId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ALTER COLUMN "exerciseTypeId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExerciseLog" DROP COLUMN "reps",
DROP COLUMN "rpe",
DROP COLUMN "weight",
ADD COLUMN     "metrics" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "ExerciseType" ADD COLUMN     "metricIds" INTEGER[];

-- AlterTable
ALTER TABLE "WorkoutPlanExercise" DROP COLUMN "targetReps",
DROP COLUMN "targetRpe",
DROP COLUMN "targetWeight",
ADD COLUMN     "targetMetrics" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "Metric" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Metric_slug_key" ON "Metric"("slug");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_exerciseTypeId_fkey" FOREIGN KEY ("exerciseTypeId") REFERENCES "ExerciseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
