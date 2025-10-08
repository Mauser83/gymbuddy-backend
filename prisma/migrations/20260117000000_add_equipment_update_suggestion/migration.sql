-- CreateTable
CREATE TABLE "EquipmentUpdateSuggestion" (
    "id" TEXT NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "proposedName" TEXT NOT NULL,
    "proposedBrand" TEXT NOT NULL,
    "proposedManualUrl" TEXT,
    "status" "EquipmentSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "submittedByUserId" INTEGER NOT NULL,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentUpdateSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentUpdateSuggestion_equipmentId_idx" ON "EquipmentUpdateSuggestion"("equipmentId");

-- AddForeignKey
ALTER TABLE "EquipmentUpdateSuggestion" ADD CONSTRAINT "EquipmentUpdateSuggestion_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentUpdateSuggestion" ADD CONSTRAINT "EquipmentUpdateSuggestion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentUpdateSuggestion" ADD CONSTRAINT "EquipmentUpdateSuggestion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;