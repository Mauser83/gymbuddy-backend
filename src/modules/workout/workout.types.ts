export interface WorkoutPlan {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

export interface CreateWorkoutInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateWorkoutInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
}
