/*
  Warnings:

  - You are about to drop the `_ExerciseToWorkoutPlan` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_workoutPlanId_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToWorkoutPlan" DROP CONSTRAINT "_ExerciseToWorkoutPlan_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToWorkoutPlan" DROP CONSTRAINT "_ExerciseToWorkoutPlan_B_fkey";

-- DropIndex
DROP INDEX "ExerciseLog_userId_idx";

-- AlterTable
ALTER TABLE "ExerciseLog" ALTER COLUMN "workoutPlanId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "_ExerciseToWorkoutPlan";

-- CreateTable
CREATE TABLE "_SharedWorkouts" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SharedWorkouts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_WorkoutExercises" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_WorkoutExercises_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SharedWorkouts_B_index" ON "_SharedWorkouts"("B");

-- CreateIndex
CREATE INDEX "_WorkoutExercises_B_index" ON "_WorkoutExercises"("B");

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SharedWorkouts" ADD CONSTRAINT "_SharedWorkouts_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SharedWorkouts" ADD CONSTRAINT "_SharedWorkouts_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkoutExercises" ADD CONSTRAINT "_WorkoutExercises_A_fkey" FOREIGN KEY ("A") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkoutExercises" ADD CONSTRAINT "_WorkoutExercises_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
