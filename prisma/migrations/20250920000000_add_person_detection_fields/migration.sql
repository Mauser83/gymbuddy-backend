ALTER TABLE "EquipmentImage"
ADD COLUMN     "personCount" INTEGER,
ADD COLUMN     "personBoxes" JSONB;

ALTER TABLE "GymEquipmentImage"
ADD COLUMN     "personCount" INTEGER,
ADD COLUMN     "personBoxes" JSONB;