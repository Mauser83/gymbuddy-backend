/*
  Warnings:

  - You are about to drop the column `gymId` on the `Equipment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Equipment" DROP CONSTRAINT "Equipment_gymId_fkey";

-- DropIndex
DROP INDEX "Equipment_gymId_idx";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "gymId";

-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "gymEquipmentId" INTEGER;

-- CreateTable
CREATE TABLE "EquipmentImage" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymEquipment" (
    "id" SERIAL NOT NULL,
    "gymId" INTEGER NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymEquipmentImage" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "gymEquipmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymEquipmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentImage_equipmentId_idx" ON "EquipmentImage"("equipmentId");

-- CreateIndex
CREATE INDEX "GymEquipment_gymId_idx" ON "GymEquipment"("gymId");

-- CreateIndex
CREATE INDEX "GymEquipment_equipmentId_idx" ON "GymEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GymEquipment_gymId_equipmentId_key" ON "GymEquipment"("gymId", "equipmentId");

-- CreateIndex
CREATE INDEX "GymEquipmentImage_gymEquipmentId_idx" ON "GymEquipmentImage"("gymEquipmentId");

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentImage" ADD CONSTRAINT "EquipmentImage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
