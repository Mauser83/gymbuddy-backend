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
  orderedMetrics: ExerciseTypeMetric[];
}

export interface ExerciseTypeMetric {
  metric: Metric;
  order: number;
}

export interface Metric {
  id: number;
  name: string;
  slug: string;
  unit: string;
  inputType: string; // e.g. "number", "time", "text"
  useInPlanning: boolean;
  minOnly: boolean;
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

export interface ExerciseTypeMetricInput {
  metricId: number;
  order: number;
}

export interface CreateExerciseTypeInput {
  name: string;
  metrics: ExerciseTypeMetricInput[];
}

export interface UpdateExerciseTypeInput {
  name: string;
  metrics: ExerciseTypeMetricInput[];
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
// 📝 Exercise Suggestions
// ---------------------

export type ExerciseSuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExerciseSuggestionSlotOption {
  subcategoryId: number;
}

export interface ExerciseSuggestionSlot {
  slotIndex: number;
  isRequired: boolean;
  comment?: string | null;
  options: ExerciseSuggestionSlotOption[];
}

export interface ExerciseSuggestion {
  id: string;
  managerUserId: number;
  gymId?: number | null;
  name: string;
  description?: string | null;
  videoUrl?: string | null;
  difficultyId: number;
  exerciseTypeId: number;
  primaryMuscleIds: number[];
  secondaryMuscleIds?: number[] | null;
  equipmentSlots: ExerciseSuggestionSlot[];
  status: ExerciseSuggestionStatus;
  approvedExerciseId?: number | null;
  rejectedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  useInPlanning?: boolean;
  minOnly?: boolean;
}

export interface UpdateMetricInput {
  name?: string;
  slug?: string;
  unit?: string;
  inputType?: string;
  useInPlanning?: boolean;
  minOnly?: boolean;
}
