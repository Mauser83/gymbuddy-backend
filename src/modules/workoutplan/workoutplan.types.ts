export interface WorkoutPlan {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  version: number;
  parentPlanId?: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;

  // ➕ NEW Relations
  exercises?: WorkoutPlanExercise[];
  assignedWorkouts?: AssignedWorkout[];
  sessions?: WorkoutSession[];
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkoutPlanInput {
  name: string;
  description?: string;
  isPublic?: boolean;

  exercises?: WorkoutPlanExerciseInput[]; // ➕ NEW
}

export interface UpdateWorkoutPlanInput {
  name?: string;
  description?: string;
  isPublic?: boolean;

  exercises?: WorkoutPlanExerciseInput[]; // ➕ NEW
}

export interface WorkoutPlanExerciseInput {
  exerciseId: number;
  order?: number;
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number;
  targetRpe?: number;
}

// Optional supporting types if needed in services/resolvers
export interface AssignedWorkout {
  id: number;
  trainerId: number;
  assigneeId: number;
  workoutPlanId: number;
  scheduledFor: string;
  status: string;
  feedback?: string;
  createdAt: string;
}

export interface WorkoutSession {
  id: number;
  userId: number;
  startedAt: string;
  endedAt?: string;
  notes?: string;
  workoutPlanId?: number;
  assignedWorkoutId?: number;
}
