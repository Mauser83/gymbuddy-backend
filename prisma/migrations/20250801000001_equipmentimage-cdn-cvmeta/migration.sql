-- AlterTable
ALTER TABLE "EquipmentImage" ADD COLUMN     "cdnUrl" TEXT,
ADD COLUMN     "phash" TEXT,
ADD COLUMN     "hasPerson" BOOLEAN,
ADD COLUMN     "modelVersion" TEXT;

-- CreateIndex
CREATE INDEX "EquipmentImage_cdnUrl_idx" ON "EquipmentImage"("cdnUrl");