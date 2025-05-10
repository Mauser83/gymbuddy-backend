export interface ExerciseLog {
  id: number;
  userId: number;
  workoutPlanId?: number | null;
  exerciseId: number;
  gymId?: number | null;
  sets?: number;
  reps?: number;
  weight?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseLogInput {
  exerciseId: number;
  workoutPlanId?: number;
  gymId?: number;
  sets?: number;
  reps?: number;
  weight?: number;
}

export interface UpdateExerciseLogInput {
  exerciseId?: number;
  workoutPlanId?: number;
  gymId?: number;
  sets?: number;
  reps?: number;
  weight?: number;
}
