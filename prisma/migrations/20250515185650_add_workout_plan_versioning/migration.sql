/*
  Warnings:

  - You are about to drop the column `equipmentId` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `reps` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `sets` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the `_WorkoutExercises` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'MISSED');

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "_WorkoutExercises" DROP CONSTRAINT "_WorkoutExercises_A_fkey";

-- DropForeignKey
ALTER TABLE "_WorkoutExercises" DROP CONSTRAINT "_WorkoutExercises_B_fkey";

-- DropIndex
DROP INDEX "Exercise_equipmentId_idx";

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "equipmentId",
DROP COLUMN "reps",
DROP COLUMN "sets",
DROP COLUMN "weight";

-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "notes" VARCHAR(1000),
ADD COLUMN     "rpe" DECIMAL(3,1),
ADD COLUMN     "workoutSessionId" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN     "parentPlanId" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "_WorkoutExercises";

-- CreateTable
CREATE TABLE "WorkoutPlanExercise" (
    "id" SERIAL NOT NULL,
    "workoutPlanId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "order" INTEGER,
    "targetSets" INTEGER,
    "targetReps" INTEGER,
    "targetWeight" DECIMAL(5,2),
    "targetRpe" DECIMAL(3,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseEquipment" (
    "id" SERIAL NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExerciseEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "workoutPlanId" INTEGER,
    "assignedWorkoutId" INTEGER,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedWorkout" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "workoutPlanId" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlanExercise_workoutPlanId_exerciseId_key" ON "WorkoutPlanExercise"("workoutPlanId", "exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseEquipment_exerciseId_idx" ON "ExerciseEquipment"("exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseEquipment_equipmentId_idx" ON "ExerciseEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseEquipment_exerciseId_equipmentId_key" ON "ExerciseEquipment"("exerciseId", "equipmentId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_idx" ON "WorkoutSession"("userId");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutPlanId_idx" ON "WorkoutSession"("workoutPlanId");

-- CreateIndex
CREATE INDEX "WorkoutSession_assignedWorkoutId_idx" ON "WorkoutSession"("assignedWorkoutId");

-- CreateIndex
CREATE INDEX "AssignedWorkout_assigneeId_idx" ON "AssignedWorkout"("assigneeId");

-- CreateIndex
CREATE INDEX "AssignedWorkout_trainerId_idx" ON "AssignedWorkout"("trainerId");

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_parentPlanId_fkey" FOREIGN KEY ("parentPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipment" ADD CONSTRAINT "ExerciseEquipment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipment" ADD CONSTRAINT "ExerciseEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_assignedWorkoutId_fkey" FOREIGN KEY ("assignedWorkoutId") REFERENCES "AssignedWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedWorkout" ADD CONSTRAINT "AssignedWorkout_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
