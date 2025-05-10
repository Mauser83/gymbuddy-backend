/*
  Warnings:

  - You are about to drop the column `category` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `equipmentType` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `muscleGroup` on the `Equipment` table. All the data in the column will be lost.
  - You are about to alter the column `brand` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - Added the required column `categoryId` to the `Equipment` table without a default value. This is not possible if the table is not empty.
  - Made the column `brand` on table `Equipment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Equipment_equipmentType_idx";

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "category",
DROP COLUMN "equipmentType",
DROP COLUMN "model",
DROP COLUMN "muscleGroup",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "manualUrl" VARCHAR(200),
ADD COLUMN     "subcategoryId" INTEGER,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "brand" SET NOT NULL,
ALTER COLUMN "brand" SET DATA TYPE VARCHAR(50);

-- CreateTable
CREATE TABLE "EquipmentCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "EquipmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSubcategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "EquipmentSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCategory_name_key" ON "EquipmentCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCategory_slug_key" ON "EquipmentCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSubcategory_name_key" ON "EquipmentSubcategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentSubcategory_slug_key" ON "EquipmentSubcategory"("slug");

-- CreateIndex
CREATE INDEX "Equipment_categoryId_idx" ON "Equipment"("categoryId");

-- CreateIndex
CREATE INDEX "Equipment_subcategoryId_idx" ON "Equipment"("subcategoryId");

-- CreateIndex
CREATE INDEX "Equipment_brand_idx" ON "Equipment"("brand");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "EquipmentSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSubcategory" ADD CONSTRAINT "EquipmentSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EquipmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
