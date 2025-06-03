// Used for admin-controlled role updates
export interface UpdateUserRolesInput {
  userId: number;
  userRole: string;
  appRole?: string;
}

// Used for self-service profile updates (username, email, etc.)
export interface UpdateUserProfileInput {
  username?: string;
  email?: string;
}

export interface UpdateUserTrainingPreferencesInput {
  trainingGoalId?: number;
  experienceLevel?: ExperienceLevel;
}

// ➕ NEW TYPES

export interface AssignedWorkout {
  id: number;
  date: string;
  userId: number; // Assignee
  trainerId: number; // Assigned by
  workoutPlanId: number;
  completed: boolean;
}

export interface WorkoutSession {
  id: number;
  userId: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// Used inside User object
export interface User {
  id: number;
  email: string;
  username?: string;
  appRole?: string;
  userRole: string;
  createdAt: string;
  updatedAt: string;
  gymManagementRoles?: GymManagementRole[];

  trainingGoalId?: number;
  trainingGoal?: TrainingGoal;
  experienceLevel?: ExperienceLevel;

  assignedWorkouts?: AssignedWorkout[];
  assignedByWorkouts?: AssignedWorkout[];
  workoutSessions?: WorkoutSession[];
}

export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface TrainingGoal {
  id: number;
  name: string;
  slug: string;
}

export interface GymManagementRole {
  id: number;
  role: string;
  gym: any;
  user: User;
}
