export interface Exercise {
  id: number;
  name: string;
  description?: string;
  equipmentId?: number;
  userId: number;
  sets?: number;
  reps?: number;
  weight?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseInput {
  name: string;
  description?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  equipmentId?: number;
}

export interface UpdateExerciseInput {
  name?: string;
  description?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  equipmentId?: number;
}
