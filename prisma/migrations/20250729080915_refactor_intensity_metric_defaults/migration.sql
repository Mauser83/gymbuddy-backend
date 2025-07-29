/*
  Warnings:

  - You are about to drop the column `defaultReps` on the `IntensityPreset` table. All the data in the column will be lost.
  - You are about to drop the column `defaultRestSec` on the `IntensityPreset` table. All the data in the column will be lost.
  - You are about to drop the column `defaultRpe` on the `IntensityPreset` table. All the data in the column will be lost.
  - You are about to drop the column `defaultSets` on the `IntensityPreset` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "IntensityPreset" DROP COLUMN "defaultReps",
DROP COLUMN "defaultRestSec",
DROP COLUMN "defaultRpe",
DROP COLUMN "defaultSets";

-- CreateTable
CREATE TABLE "IntensityMetricDefault" (
    "id" SERIAL NOT NULL,
    "metricId" INTEGER NOT NULL,
    "defaultMin" DOUBLE PRECISION NOT NULL,
    "defaultMax" DOUBLE PRECISION,
    "presetId" INTEGER NOT NULL,

    CONSTRAINT "IntensityMetricDefault_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IntensityMetricDefault" ADD CONSTRAINT "IntensityMetricDefault_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "IntensityPreset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
