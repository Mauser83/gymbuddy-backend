/*
  Warnings:

  - You are about to drop the column `workoutTypeId` on the `WorkoutPlan` table. All the data in the column will be lost.
  - You are about to drop the `WorkoutCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkoutType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_WorkoutTypeToCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- DropForeignKey
ALTER TABLE "WorkoutPlan" DROP CONSTRAINT "WorkoutPlan_workoutTypeId_fkey";

-- DropForeignKey
ALTER TABLE "_WorkoutTypeToCategory" DROP CONSTRAINT "_WorkoutTypeToCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_WorkoutTypeToCategory" DROP CONSTRAINT "_WorkoutTypeToCategory_B_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "trainingGoalId" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutPlan" DROP COLUMN "workoutTypeId",
ADD COLUMN     "trainingGoalId" INTEGER;

-- DropTable
DROP TABLE "WorkoutCategory";

-- DropTable
DROP TABLE "WorkoutType";

-- DropTable
DROP TABLE "_WorkoutTypeToCategory";

-- CreateTable
CREATE TABLE "TrainingGoal" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "TrainingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensityPreset" (
    "id" SERIAL NOT NULL,
    "trainingGoalId" INTEGER NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "defaultSets" INTEGER NOT NULL,
    "defaultReps" INTEGER NOT NULL,
    "defaultRestSec" INTEGER NOT NULL,
    "defaultRpe" INTEGER NOT NULL,

    CONSTRAINT "IntensityPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGoal_slug_key" ON "TrainingGoal"("slug");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trainingGoalId_fkey" FOREIGN KEY ("trainingGoalId") REFERENCES "TrainingGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_trainingGoalId_fkey" FOREIGN KEY ("trainingGoalId") REFERENCES "TrainingGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensityPreset" ADD CONSTRAINT "IntensityPreset_trainingGoalId_fkey" FOREIGN KEY ("trainingGoalId") REFERENCES "TrainingGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
