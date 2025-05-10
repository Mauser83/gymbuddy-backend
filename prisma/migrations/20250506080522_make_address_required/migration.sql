/*
  Warnings:

  - Made the column `address` on table `Gym` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Gym" ALTER COLUMN "address" SET NOT NULL;
