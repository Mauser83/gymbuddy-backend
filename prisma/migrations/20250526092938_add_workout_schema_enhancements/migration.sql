-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "isWarmup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkoutPlan" ADD COLUMN     "workoutTypeId" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutPlanExercise" ADD COLUMN     "isWarmup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trainingMethodId" INTEGER;

-- CreateTable
CREATE TABLE "WorkoutCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "WorkoutCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "WorkoutType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuscleGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "MuscleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMethod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TrainingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlanMuscleGroups" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PlanMuscleGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCategory_name_key" ON "WorkoutCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCategory_slug_key" ON "WorkoutCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutType_name_key" ON "WorkoutType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutType_slug_key" ON "WorkoutType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MuscleGroup_name_key" ON "MuscleGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MuscleGroup_slug_key" ON "MuscleGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingMethod_name_key" ON "TrainingMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingMethod_slug_key" ON "TrainingMethod"("slug");

-- CreateIndex
CREATE INDEX "_PlanMuscleGroups_B_index" ON "_PlanMuscleGroups"("B");

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_workoutTypeId_fkey" FOREIGN KEY ("workoutTypeId") REFERENCES "WorkoutType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_trainingMethodId_fkey" FOREIGN KEY ("trainingMethodId") REFERENCES "TrainingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutType" ADD CONSTRAINT "WorkoutType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WorkoutCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanMuscleGroups" ADD CONSTRAINT "_PlanMuscleGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanMuscleGroups" ADD CONSTRAINT "_PlanMuscleGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
