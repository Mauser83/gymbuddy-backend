-- AlterTable
ALTER TABLE "WorkoutPlanExercise" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "_TrainingMethodToGoal" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TrainingMethodToGoal_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TrainingMethodToGoal_B_index" ON "_TrainingMethodToGoal"("B");

-- AddForeignKey
ALTER TABLE "_TrainingMethodToGoal" ADD CONSTRAINT "_TrainingMethodToGoal_A_fkey" FOREIGN KEY ("A") REFERENCES "TrainingGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TrainingMethodToGoal" ADD CONSTRAINT "_TrainingMethodToGoal_B_fkey" FOREIGN KEY ("B") REFERENCES "TrainingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
