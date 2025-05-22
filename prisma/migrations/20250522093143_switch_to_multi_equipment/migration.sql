/*
  Warnings:

  - You are about to drop the column `gymEquipmentId` on the `ExerciseLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_gymEquipmentId_fkey";

-- DropIndex
DROP INDEX "ExerciseLog_gymEquipmentId_idx";

-- AlterTable
ALTER TABLE "ExerciseLog" DROP COLUMN "gymEquipmentId";

-- CreateTable
CREATE TABLE "ExerciseLogEquipment" (
    "id" SERIAL NOT NULL,
    "exerciseLogId" INTEGER NOT NULL,
    "gymEquipmentId" INTEGER NOT NULL,

    CONSTRAINT "ExerciseLogEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLogEquipment_exerciseLogId_gymEquipmentId_key" ON "ExerciseLogEquipment"("exerciseLogId", "gymEquipmentId");

-- AddForeignKey
ALTER TABLE "ExerciseLogEquipment" ADD CONSTRAINT "ExerciseLogEquipment_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "ExerciseLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLogEquipment" ADD CONSTRAINT "ExerciseLogEquipment_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
