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

// ➕ NEW TYPES

export interface AssignedWorkout {
  id: number;
  date: string;
  userId: number;         // Assignee
  trainerId: number;      // Assigned by
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

  // ➕ NEW FIELDS
  assignedWorkouts?: AssignedWorkout[];
  assignedByWorkouts?: AssignedWorkout[];
  workoutSessions?: WorkoutSession[];
}

export interface GymManagementRole {
  id: number;
  role: string;
  gym: any;
  user: User;
}
