import { Exercise } from "../exercise/exercise.types";

export interface Equipment {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  subcategoryId?: number;
  brand: string;
  manualUrl?: string;
  createdAt: string; // ISO string
  updatedAt: string;
  deletedAt?: string;
  images?: EquipmentImage[];

  // ✅ NEW: Exercises that use this equipment's subcategory
  compatibleExercises?: Exercise[];
}

export interface EquipmentImage {
  id: string;
  equipmentId: number;
  storageKey: string;
  sha256?: string;
  createdAt: string;
  updatedAt?: string;
  thumbUrl?: string;
}

export interface CreateEquipmentInput {
  name: string;
  description?: string;
  categoryId: number;
  subcategoryId?: number;
  brand: string;
  manualUrl?: string;
}

export interface UpdateEquipmentInput {
  name?: string;
  description?: string;
  categoryId?: number;
  subcategoryId?: number;
  brand?: string;
  manualUrl?: string;
}

export interface UploadEquipmentImageInput {
  equipmentId: number;
  storageKey: string;
  sha256?: string;
}

export interface CreateEquipmentCategoryInput {
  name: string;
  slug: string;
}

export interface UpdateEquipmentCategoryInput {
  name: string;
  slug: string;
}

export interface CreateEquipmentSubcategoryInput {
  name: string;
  slug: string;
  categoryId: number;
}

export interface UpdateEquipmentSubcategoryInput {
  name: string;
  slug: string;
}
