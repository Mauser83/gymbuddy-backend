-- CreateTable
CREATE TABLE "WorkoutProgram" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgramDay" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "workoutPlanId" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "WorkoutProgramDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgramMuscleCooldown" (
    "id" SERIAL NOT NULL,
    "programId" INTEGER NOT NULL,
    "muscleGroupId" INTEGER NOT NULL,
    "daysRequired" INTEGER NOT NULL,

    CONSTRAINT "WorkoutProgramMuscleCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMuscleCooldownOverride" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "muscleGroupId" INTEGER NOT NULL,
    "daysRequired" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "UserMuscleCooldownOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgramAssignment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "programDayId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "overrideDate" TIMESTAMP(3),
    "workoutProgramId" INTEGER,

    CONSTRAINT "WorkoutProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkoutPreferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "preferredWorkoutDays" INTEGER[],
    "preferredRestDays" INTEGER[],
    "autoReschedule" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserWorkoutPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserMuscleCooldownOverride_userId_muscleGroupId_key" ON "UserMuscleCooldownOverride"("userId", "muscleGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorkoutPreferences_userId_key" ON "UserWorkoutPreferences"("userId");

-- AddForeignKey
ALTER TABLE "WorkoutProgram" ADD CONSTRAINT "WorkoutProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramDay" ADD CONSTRAINT "WorkoutProgramDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramDay" ADD CONSTRAINT "WorkoutProgramDay_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramMuscleCooldown" ADD CONSTRAINT "WorkoutProgramMuscleCooldown_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramMuscleCooldown" ADD CONSTRAINT "WorkoutProgramMuscleCooldown_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleCooldownOverride" ADD CONSTRAINT "UserMuscleCooldownOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMuscleCooldownOverride" ADD CONSTRAINT "UserMuscleCooldownOverride_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramAssignment" ADD CONSTRAINT "WorkoutProgramAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramAssignment" ADD CONSTRAINT "WorkoutProgramAssignment_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "WorkoutProgramDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgramAssignment" ADD CONSTRAINT "WorkoutProgramAssignment_workoutProgramId_fkey" FOREIGN KEY ("workoutProgramId") REFERENCES "WorkoutProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkoutPreferences" ADD CONSTRAINT "UserWorkoutPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
