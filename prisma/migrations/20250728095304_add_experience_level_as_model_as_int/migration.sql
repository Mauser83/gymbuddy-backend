/*
  Warnings:

  - The primary key for the `ExperienceLevel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `order` on the `ExperienceLevel` table. All the data in the column will be lost.
  - The `id` column on the `ExperienceLevel` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `experienceLevelId` column on the `IntensityPreset` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `experienceLevelId` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `experienceLevelId` column on the `WorkoutPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "IntensityPreset" DROP CONSTRAINT "IntensityPreset_experienceLevelId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_experienceLevelId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutPlan" DROP CONSTRAINT "WorkoutPlan_experienceLevelId_fkey";

-- AlterTable
ALTER TABLE "ExperienceLevel" DROP CONSTRAINT "ExperienceLevel_pkey",
DROP COLUMN "order",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "ExperienceLevel_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "IntensityPreset" DROP COLUMN "experienceLevelId",
ADD COLUMN     "experienceLevelId" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "experienceLevelId",
ADD COLUMN     "experienceLevelId" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutPlan" DROP COLUMN "experienceLevelId",
ADD COLUMN     "experienceLevelId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensityPreset" ADD CONSTRAINT "IntensityPreset_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
