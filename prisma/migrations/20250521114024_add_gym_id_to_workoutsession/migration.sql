/*
  Warnings:

  - Added the required column `gymId` to the `WorkoutSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "gymId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "WorkoutSession_gymId_idx" ON "WorkoutSession"("gymId");

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
