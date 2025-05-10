-- CreateIndex
CREATE INDEX "Equipment_gymId_idx" ON "Equipment"("gymId");

-- CreateIndex
CREATE INDEX "Equipment_equipmentType_idx" ON "Equipment"("equipmentType");

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE INDEX "Exercise_equipmentId_idx" ON "Exercise"("equipmentId");

-- CreateIndex
CREATE INDEX "ExerciseLog_userId_idx" ON "ExerciseLog"("userId");

-- CreateIndex
CREATE INDEX "ExerciseLog_workoutPlanId_idx" ON "ExerciseLog"("workoutPlanId");

-- CreateIndex
CREATE INDEX "ExerciseLog_exerciseId_idx" ON "ExerciseLog"("exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseLog_gymId_idx" ON "ExerciseLog"("gymId");

-- CreateIndex
CREATE INDEX "Gym_name_idx" ON "Gym"("name");

-- CreateIndex
CREATE INDEX "Gym_location_idx" ON "Gym"("location");
