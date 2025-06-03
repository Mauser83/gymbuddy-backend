-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN     "intensityPresetId" INTEGER;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_intensityPresetId_fkey" FOREIGN KEY ("intensityPresetId") REFERENCES "IntensityPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
