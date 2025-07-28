/*
  Warnings:

  - You are about to drop the column `experienceLevel` on the `IntensityPreset` table. All the data in the column will be lost.
  - You are about to drop the column `experienceLevel` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "IntensityPreset" DROP COLUMN "experienceLevel",
ADD COLUMN     "experienceLevelId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "experienceLevel",
ADD COLUMN     "experienceLevelId" TEXT;

-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN     "experienceLevelId" TEXT;

-- DropEnum
DROP TYPE "ExperienceLevel";

-- CreateTable
CREATE TABLE "ExperienceLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceLevel_name_key" ON "ExperienceLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceLevel_key_key" ON "ExperienceLevel"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensityPreset" ADD CONSTRAINT "IntensityPreset_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "ExperienceLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
