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

  // ➕ NEW: Exercises that use this equipment
  exercises?: Exercise[];
}

export interface EquipmentImage {
  id: number;
  equipmentId: number;
  url: string;
  createdAt: string;
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
  url: string;
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
