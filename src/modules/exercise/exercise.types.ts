// ---------------------
// ✨ Core Entities
// ---------------------

export interface Exercise {
  id: number;
  name: string;
  description?: string;
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
  userId: number;

  difficulty: ExerciseDifficulty;
  exerciseType: ExerciseType;
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  equipmentSlots?: ExerciseEquipmentSlot[];
  workoutPlanEntries?: WorkoutPlanExercise[];
}

export interface ExerciseEquipmentSlot {
  id: number;
  slotIndex: number;
  isRequired: boolean;
  comment?: string;
  options: ExerciseEquipmentOption[];
}

export interface ExerciseEquipmentOption {
  id: number;
  subcategory: EquipmentSubcategory;
}

export interface EquipmentSubcategory {
  id: number;
  name: string;
  slug: string;
  category: EquipmentCategory;
}

export interface EquipmentCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ExerciseType {
  id: number;
  name: string;
  metricIds: number[];
  metrics: Metric[]; // resolved metric objects
}

export interface Metric {
  id: number;
  name: string;
  slug: string;
  unit: string;
  inputType: string; // e.g. "number", "time", "text"
}

export interface MetricTarget {
  metricId: number;
  min: number;
  max?: number;
}

export interface ExerciseDifficulty {
  id: number;
  level: string;
}

export interface Muscle {
  id: number;
  name: string;
  bodyPart: BodyPart;
}

export interface BodyPart {
  id: number;
  name: string;
  muscles?: Muscle[]; // for frontend grouping
}

// ---------------------
// 🧩 Reference Inputs
// ---------------------

export interface CreateExerciseTypeInput {
  name: string;
  metricIds: number[];
}

export interface UpdateExerciseTypeInput {
  name: string;
  metricIds: number[];
}

export interface CreateExerciseDifficultyInput {
  level: string;
}

export interface UpdateExerciseDifficultyInput {
  level: string;
}

export interface CreateBodyPartInput {
  name: string;
}

export interface UpdateBodyPartInput {
  name: string;
}

export interface CreateMuscleInput {
  name: string;
  bodyPartId: number;
}

export interface UpdateMuscleInput {
  name: string;
  bodyPartId: number;
}

// ---------------------
// 🏋️ Exercise Inputs
// ---------------------

export interface CreateExerciseInput {
  name: string;
  description?: string;
  videoUrl?: string;
  difficultyId?: number;
  exerciseTypeId?: number;
  primaryMuscleIds: number[];
  secondaryMuscleIds?: number[];
  equipmentSlots: CreateExerciseSlotInput[];
}

export interface UpdateExerciseInput {
  name?: string;
  description?: string;
  videoUrl?: string;
  difficultyId?: number;
  exerciseTypeId?: number;
  primaryMuscleIds?: number[];
  secondaryMuscleIds?: number[];
  equipmentSlots?: CreateExerciseSlotInput[];
}

export interface CreateExerciseSlotInput {
  slotIndex: number;
  isRequired: boolean;
  comment?: string;
  options: CreateExerciseSlotOptionInput[];
}

export interface CreateExerciseSlotOptionInput {
  subcategoryId: number;
}

// ---------------------
// Other
// ---------------------

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

export interface ExerciseQueryFilters {
  exerciseType?: string[];
  difficulty?: string[];
  bodyPart?: string[];
  muscle?: string[];
}

export interface CreateMetricInput {
  name: string;
  slug: string;
  unit: string;
  inputType: string;
}

export interface UpdateMetricInput {
  name?: string;
  slug?: string;
  unit?: string;
  inputType?: string;
}
