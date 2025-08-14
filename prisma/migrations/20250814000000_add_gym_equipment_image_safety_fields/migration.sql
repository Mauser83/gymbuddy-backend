-- AlterTable
ALTER TABLE "GymEquipmentImage"
ADD COLUMN     "isSafe" BOOLEAN,
ADD COLUMN     "nsfwScore" DOUBLE PRECISION,
ADD COLUMN     "hasPerson" BOOLEAN;