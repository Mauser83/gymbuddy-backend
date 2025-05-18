export interface ExerciseLog {
  id: number;
  userId: number;
  workoutPlanId?: number | null;
  workoutSessionId?: number | null;
  exerciseId: number;
  gymId?: number | null;
  gymEquipmentId?: number | null;

  rpe?: number;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseLogInput {
  exerciseId: number;
  workoutPlanId?: number;
  workoutSessionId?: number;
  gymId?: number;
  gymEquipmentId?: number;

  rpe?: number;
  notes?: string;
}

export interface UpdateExerciseLogInput {
  exerciseId?: number;
  workoutPlanId?: number;
  workoutSessionId?: number;
  gymId?: number;
  gymEquipmentId?: number;

  rpe?: number;
  notes?: string;
}
