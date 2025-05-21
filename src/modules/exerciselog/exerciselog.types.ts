export interface ExerciseLog {
  id: number;
  exerciseId: number;
  gymEquipmentId: number;
  workoutSessionId: number;

  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseLogInput {
  exerciseId: number;
  gymEquipmentId: number;
  workoutSessionId: number;

  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
  notes?: string;
}

export interface UpdateExerciseLogInput {
  setNumber?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  notes?: string;
}
