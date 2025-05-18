/*
  Warnings:

  - You are about to drop the column `bodyPartId` on the `Exercise` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_bodyPartId_fkey";

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "bodyPartId";
