/*
  Warnings:

  - You are about to drop the column `categoryId` on the `WorkoutType` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkoutType" DROP CONSTRAINT "WorkoutType_categoryId_fkey";

-- AlterTable
ALTER TABLE "WorkoutType" DROP COLUMN "categoryId";

-- CreateTable
CREATE TABLE "_WorkoutTypeToCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_WorkoutTypeToCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_WorkoutTypeToCategory_B_index" ON "_WorkoutTypeToCategory"("B");

-- AddForeignKey
ALTER TABLE "_WorkoutTypeToCategory" ADD CONSTRAINT "_WorkoutTypeToCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "WorkoutCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WorkoutTypeToCategory" ADD CONSTRAINT "_WorkoutTypeToCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkoutType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
