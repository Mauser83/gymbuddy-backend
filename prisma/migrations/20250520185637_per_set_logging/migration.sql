/*
  Warnings:

  - You are about to drop the column `gymId` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `sets` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ExerciseLog` table. All the data in the column will be lost.
  - You are about to drop the column `workoutPlanId` on the `ExerciseLog` table. All the data in the column will be lost.
  - Added the required column `setNumber` to the `ExerciseLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `reps` on table `ExerciseLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `weight` on table `ExerciseLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gymEquipmentId` on table `ExerciseLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workoutSessionId` on table `ExerciseLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_gymEquipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_gymId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_workoutPlanId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_workoutSessionId_fkey";

-- DropIndex
DROP INDEX "ExerciseLog_gymId_idx";

-- DropIndex
DROP INDEX "ExerciseLog_userId_idx";

-- DropIndex
DROP INDEX "ExerciseLog_workoutPlanId_idx";

-- AlterTable
ALTER TABLE "ExerciseLog" DROP COLUMN "gymId",
DROP COLUMN "sets",
DROP COLUMN "userId",
DROP COLUMN "workoutPlanId",
ADD COLUMN     "setNumber" INTEGER NOT NULL,
ALTER COLUMN "reps" SET NOT NULL,
ALTER COLUMN "weight" SET NOT NULL,
ALTER COLUMN "gymEquipmentId" SET NOT NULL,
ALTER COLUMN "workoutSessionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ExerciseLog_gymEquipmentId_idx" ON "ExerciseLog"("gymEquipmentId");

-- CreateIndex
CREATE INDEX "ExerciseLog_workoutSessionId_idx" ON "ExerciseLog"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
