import { BodyPart } from "../exercise/exercise.types";

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
  name: string;
  description?: string;
  isPublic?: boolean;
  workoutTypeId: number;
  muscleGroupIds: number[];
  exercises: WorkoutPlanExerciseInput[];
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
  workoutTypes?: WorkoutType[];
}

export interface WorkoutType {
  id: number;
  name: string;
  slug: string;
  categories?: WorkoutCategory[]; // ✅ now an array
}

export interface MuscleGroup {
  id: number;
  name: string;
  slug: string;

  bodyParts?: BodyPart[]; // ✅ Add this line
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

// 🔁 Workout Program Types

export interface WorkoutProgram {
  id: number;
  name: string;
  notes?: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;

  days?: WorkoutProgramDay[];
  cooldowns?: WorkoutProgramMuscleCooldown[];
  assignments?: WorkoutProgramAssignment[];
}

export interface WorkoutProgramDay {
  id: number;
  programId: number;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  workoutPlanId: number;
  notes?: string;

  program?: WorkoutProgram;
  workoutPlan?: WorkoutPlan;
  assignments?: WorkoutProgramAssignment[];
}

export interface WorkoutProgramMuscleCooldown {
  id: number;
  programId: number;
  muscleGroupId: number;
  daysRequired: number;

  program?: WorkoutProgram;
  muscleGroup?: MuscleGroup;
}

export interface UserMuscleCooldownOverride {
  id: number;
  userId: number;
  muscleGroupId: number;
  daysRequired: number;
  notes?: string;

  muscleGroup?: MuscleGroup;
}

export interface WorkoutProgramAssignment {
  id: number;
  userId: number;
  programDayId: number;
  scheduledDate: string;
  status: AssignmentStatus;
  overrideDate?: string;

  user?: User;
  programDay?: WorkoutProgramDay;
}

export interface UserWorkoutPreferences {
  id: number;
  userId: number;
  preferredWorkoutDays: number[];
  preferredRestDays: number[];
  autoReschedule: boolean;
}

// Enums
export type AssignmentStatus = "PENDING" | "COMPLETED" | "MISSED";

// Inputs

export interface CreateWorkoutProgramInput {
  name: string;
  notes?: string;
}

export interface UpdateWorkoutProgramInput {
  name?: string;
  notes?: string;
}

export interface CreateWorkoutProgramDayInput {
  programId: number;
  dayOfWeek: number;
  workoutPlanId: number;
  notes?: string;
}

export interface UpdateWorkoutProgramDayInput {
  dayOfWeek?: number;
  workoutPlanId?: number;
  notes?: string;
}

export interface CreateWorkoutProgramCooldownInput {
  programId: number;
  muscleGroupId: number;
  daysRequired: number;
}

export interface CreateWorkoutProgramAssignmentInput {
  userId: number;
  programDayId: number;
  scheduledDate: string;
  overrideDate?: string;
}

export interface SetUserWorkoutPreferencesInput {
  preferredWorkoutDays: number[];
  preferredRestDays: number[];
  autoReschedule?: boolean;
}

// Optional user reference
export interface User {
  id: number;
  username: string;
  email: string;
}
