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

  workoutType?: WorkoutType;
  workoutTypeId?: number;

  muscleGroups?: MuscleGroup[];

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
  isWarmup: boolean;
  trainingMethod?: TrainingMethod;
  trainingMethodId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkoutPlanInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  workoutTypeId?: number;
  muscleGroupIds?: number[];
  exercises?: WorkoutPlanExerciseInput[];
}

export interface UpdateWorkoutPlanInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  workoutTypeId?: number;
  muscleGroupIds?: number[];
  exercises?: WorkoutPlanExerciseInput[];
}

export interface WorkoutPlanExerciseInput {
  exerciseId: number;
  order?: number;
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number;
  targetRpe?: number;
  trainingMethodId?: number;
  isWarmup?: boolean;
}

// ➕ New Types
export interface WorkoutCategory {
  id: number;
  name: string;
  slug: string;
  types?: WorkoutType[];
}

export interface WorkoutType {
  id: number;
  name: string;
  slug: string;
  categoryId: number;
  category?: WorkoutCategory;
}

export interface MuscleGroup {
  id: number;
  name: string;
  slug: string;
}

export interface TrainingMethod {
  id: number;
  name: string;
  slug: string;
  description?: string;
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
