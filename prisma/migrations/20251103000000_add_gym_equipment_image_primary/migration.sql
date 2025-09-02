ALTER TABLE "GymEquipmentImage" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "uq_gym_equipment_primary" ON "GymEquipmentImage"("gymEquipmentId") WHERE "isPrimary" = true;