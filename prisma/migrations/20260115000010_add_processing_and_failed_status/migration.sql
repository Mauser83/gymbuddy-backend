-- AlterEnum
ALTER TYPE "GymImageStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "GymImageStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- AlterTable
ALTER TABLE "ImageQueue" ADD COLUMN "gymImageId" TEXT;

-- CreateIndex
CREATE INDEX "ImageQueue_gymImageId_idx" ON "ImageQueue"("gymImageId");

-- AddForeignKey
ALTER TABLE "ImageQueue" ADD CONSTRAINT "ImageQueue_gymImageId_fkey" FOREIGN KEY ("gymImageId") REFERENCES "GymEquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;