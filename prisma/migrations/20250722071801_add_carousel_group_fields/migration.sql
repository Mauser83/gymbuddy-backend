-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "carouselOrder" INTEGER,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "instanceKey" TEXT,
ADD COLUMN     "isAutoFilled" BOOLEAN DEFAULT false;
