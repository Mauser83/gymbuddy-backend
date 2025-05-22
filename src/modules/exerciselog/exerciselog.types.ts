export interface ExerciseLog {
  id: number;
  exerciseId: number;
  workoutSessionId: number;

  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
  notes?: string;

  equipmentIds: number[]; // ✅ new field

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseLogInput {
  exerciseId: number;
  workoutSessionId: number;

  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
  notes?: string;

  equipmentIds: number[]; // ✅ new field
}

export interface UpdateExerciseLogInput {
  setNumber?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  notes?: string;

  equipmentIds?: number[]; // ✅ new optional field
}

export interface WorkoutSession {
  id: number;
  userId: number;
  gymId: number;
  startedAt: Date;
  endedAt?: Date;
  notes?: string;
  workoutPlanId?: number;
  assignedWorkoutId?: number;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  gym?: {
    name: string;
  };
  workoutPlan?: {
    name: string;
  };
  exerciseLogs?: ExerciseLog[];
}

export interface CreateWorkoutSessionInput {
  userId: number;
  gymId: number;
  startedAt: Date | string;
  workoutPlanId?: number;
  assignedWorkoutId?: number;
  notes?: string;
}

export interface UpdateWorkoutSessionInput {
  endedAt?: Date | string;
  notes?: string;
}
