-- CreateEnum
CREATE TYPE "GymImageStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "GymEquipmentImage" ADD COLUMN     "status" "GymImageStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "candidateForGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recognitionScoreAtCapture" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "GymEquipmentImage_status_idx" ON "GymEquipmentImage"("status");