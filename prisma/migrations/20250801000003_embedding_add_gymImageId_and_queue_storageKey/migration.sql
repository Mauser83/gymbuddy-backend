-- DropForeignKey
ALTER TABLE "GymEquipmentImage" DROP CONSTRAINT IF EXISTS "GymEquipmentImage_gymEquipmentId_fkey";

-- AlterTable
ALTER TABLE "GymEquipmentImage" ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "gymEquipmentId" DROP NOT NULL,
ALTER COLUMN "imageId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ImageEmbedding" ADD COLUMN     "gymImageId" TEXT,
ALTER COLUMN "imageId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ImageQueue" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "imageId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GymEquipmentImage_sha256_key" ON "GymEquipmentImage"("sha256");

-- CreateIndex
CREATE INDEX "GymEquipmentImage_sha256_idx" ON "GymEquipmentImage"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ImageEmbedding_gymImageId_scope_modelVendor_modelName_model_key" ON "ImageEmbedding"("gymImageId", "scope", "modelVendor", "modelName", "modelVersion");

-- CreateIndex
CREATE INDEX "ImageQueue_storageKey_idx" ON "ImageQueue"("storageKey");

-- AddForeignKey
ALTER TABLE "GymEquipmentImage" ADD CONSTRAINT "GymEquipmentImage_gymEquipmentId_fkey" FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageEmbedding" ADD CONSTRAINT "ImageEmbedding_gymImageId_fkey" FOREIGN KEY ("gymImageId") REFERENCES "GymEquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
