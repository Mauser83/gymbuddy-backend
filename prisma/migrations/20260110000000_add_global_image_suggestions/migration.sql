-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "GlobalImageSuggestion" (
    "id" TEXT NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "gymImageId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "usefulnessScore" DOUBLE PRECISION NOT NULL,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "nearDupImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalImageSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalImageSuggestion_sha256_key" ON "GlobalImageSuggestion"("sha256");
CREATE INDEX "GlobalImageSuggestion_equipmentId_status_idx" ON "GlobalImageSuggestion"("equipmentId", "status");

-- AddForeignKey
ALTER TABLE "GlobalImageSuggestion" ADD CONSTRAINT "GlobalImageSuggestion_gymImageId_fkey" FOREIGN KEY ("gymImageId") REFERENCES "GymEquipmentImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlobalImageSuggestion" ADD CONSTRAINT "GlobalImageSuggestion_nearDupImageId_fkey" FOREIGN KEY ("nearDupImageId") REFERENCES "EquipmentImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;