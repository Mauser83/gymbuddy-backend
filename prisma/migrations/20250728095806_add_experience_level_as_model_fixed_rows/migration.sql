/*
  Warnings:

  - Made the column `experienceLevelId` on table `IntensityPreset` required. This step will fail if there are existing NULL values in that column.
  - Made the column `experienceLevelId` on table `WorkoutPlan` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "IntensityPreset" DROP CONSTRAINT "IntensityPreset_experienceLevelId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutPlan" DROP CONSTRAINT "WorkoutPlan_experienceLevelId_fkey";

-- AlterTable
ALTER TABLE "IntensityPreset" ALTER COLUMN "experienceLevelId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutPlan" ALTER COLUMN "experienceLevelId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensityPreset" ADD CONSTRAINT "IntensityPreset_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
