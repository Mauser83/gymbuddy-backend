/*
  Warnings:

  - You are about to drop the column `metricIds` on the `ExerciseType` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ExerciseType" DROP COLUMN "metricIds";

-- CreateTable
CREATE TABLE "ExerciseTypeMetric" (
    "exerciseTypeId" INTEGER NOT NULL,
    "metricId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ExerciseTypeMetric_pkey" PRIMARY KEY ("exerciseTypeId","metricId")
);

-- AddForeignKey
ALTER TABLE "ExerciseTypeMetric" ADD CONSTRAINT "ExerciseTypeMetric_exerciseTypeId_fkey" FOREIGN KEY ("exerciseTypeId") REFERENCES "ExerciseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseTypeMetric" ADD CONSTRAINT "ExerciseTypeMetric_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
