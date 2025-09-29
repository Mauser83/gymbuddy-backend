-- CreateEnum
CREATE TYPE "EquipmentSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "EquipmentSuggestion" (
    "id" TEXT NOT NULL,
    "gymId" INTEGER,
    "managerUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT NOT NULL,
    "manualUrl" TEXT,
    "categoryId" INTEGER NOT NULL,
    "subcategoryId" INTEGER,
    "addToGymOnApprove" BOOLEAN NOT NULL DEFAULT true,
    "status" "EquipmentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "approvedEquipmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSuggestionImage" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentSuggestionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSuggestionImage_storageKey_key" ON "EquipmentSuggestionImage"("storageKey");
CREATE UNIQUE INDEX "EquipmentSuggestionImage_sha256_key" ON "EquipmentSuggestionImage"("sha256");
CREATE INDEX "EquipmentSuggestion_status_categoryId_idx" ON "EquipmentSuggestion"("status", "categoryId");
CREATE INDEX "EquipmentSuggestion_status_gymId_idx" ON "EquipmentSuggestion"("status", "gymId");
CREATE INDEX "EquipmentSuggestionImage_suggestionId_idx" ON "EquipmentSuggestionImage"("suggestionId");

-- AddForeignKey
ALTER TABLE "EquipmentSuggestion" ADD CONSTRAINT "EquipmentSuggestion_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentSuggestion" ADD CONSTRAINT "EquipmentSuggestion_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentSuggestion" ADD CONSTRAINT "EquipmentSuggestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentSuggestion" ADD CONSTRAINT "EquipmentSuggestion_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "EquipmentSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentSuggestion" ADD CONSTRAINT "EquipmentSuggestion_approvedEquipmentId_fkey" FOREIGN KEY ("approvedEquipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentSuggestionImage" ADD CONSTRAINT "EquipmentSuggestionImage_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "EquipmentSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;