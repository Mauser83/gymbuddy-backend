export interface Exercise {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;

  // ➕ NEW: Relation fields
  equipments?: Equipment[];
  workoutPlanEntries?: WorkoutPlanExercise[];
}

// Use these if not already declared elsewhere
export interface Equipment {
  id: number;
  name: string;
  brand: string;
  description?: string;
}

export interface WorkoutPlanExercise {
  id: number;
  workoutPlanId: number;
  exerciseId: number;
  order?: number;
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number;
  targetRpe?: number;
}

export interface CreateExerciseInput {
  name: string;
  description?: string;

  // ➕ NEW: Support multi-equipment link
  equipmentIds?: number[];
}

export interface UpdateExerciseInput {
  name?: string;
  description?: string;
  equipmentIds?: number[];
}
