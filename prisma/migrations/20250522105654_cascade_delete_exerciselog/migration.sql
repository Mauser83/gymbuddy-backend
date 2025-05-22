-- DropForeignKey
ALTER TABLE "ExerciseLogEquipment" DROP CONSTRAINT "ExerciseLogEquipment_exerciseLogId_fkey";

-- AddForeignKey
ALTER TABLE "ExerciseLogEquipment" ADD CONSTRAINT "ExerciseLogEquipment_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "ExerciseLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
