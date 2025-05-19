/*
  Warnings:

  - You are about to drop the `ExerciseEquipment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExerciseEquipment" DROP CONSTRAINT "ExerciseEquipment_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseEquipment" DROP CONSTRAINT "ExerciseEquipment_exerciseId_fkey";

-- DropTable
DROP TABLE "ExerciseEquipment";

-- CreateTable
CREATE TABLE "ExerciseEquipmentSlot" (
    "id" SERIAL NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "comment" VARCHAR(300),

    CONSTRAINT "ExerciseEquipmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseEquipmentOption" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "subcategoryId" INTEGER NOT NULL,

    CONSTRAINT "ExerciseEquipmentOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseEquipmentSlot_exerciseId_idx" ON "ExerciseEquipmentSlot"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseEquipmentSlot_exerciseId_slotIndex_key" ON "ExerciseEquipmentSlot"("exerciseId", "slotIndex");

-- CreateIndex
CREATE INDEX "ExerciseEquipmentOption_slotId_idx" ON "ExerciseEquipmentOption"("slotId");

-- CreateIndex
CREATE INDEX "ExerciseEquipmentOption_subcategoryId_idx" ON "ExerciseEquipmentOption"("subcategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseEquipmentOption_slotId_subcategoryId_key" ON "ExerciseEquipmentOption"("slotId", "subcategoryId");

-- AddForeignKey
ALTER TABLE "ExerciseEquipmentSlot" ADD CONSTRAINT "ExerciseEquipmentSlot_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipmentOption" ADD CONSTRAINT "ExerciseEquipmentOption_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ExerciseEquipmentSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEquipmentOption" ADD CONSTRAINT "ExerciseEquipmentOption_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "EquipmentSubcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
