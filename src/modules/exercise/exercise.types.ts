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

  difficulty?: ExerciseDifficulty;
  exerciseType?: ExerciseType;
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
}

export interface UpdateExerciseTypeInput {
  name: string;
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
