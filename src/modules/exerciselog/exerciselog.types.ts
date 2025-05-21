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
