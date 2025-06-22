-- CreateTable
CREATE TABLE "WorkoutPlanGroup" (
    "id" SERIAL NOT NULL,
    "workoutPlanId" INTEGER NOT NULL,
    "trainingMethodId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlanGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WorkoutPlanGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanGroup" ADD CONSTRAINT "WorkoutPlanGroup_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanGroup" ADD CONSTRAINT "WorkoutPlanGroup_trainingMethodId_fkey" FOREIGN KEY ("trainingMethodId") REFERENCES "TrainingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
