export interface Equipment {
  id: number;
  name: string;
  description?: string;
  categoryId: number;
  subcategoryId?: number;
  brand: string;
  manualUrl?: string;
  gymId?: number;
  createdAt: string; // ISO string
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateEquipmentInput {
  name: string;
  description?: string;
  categoryId: number;
  subcategoryId?: number;
  brand: string;
  manualUrl?: string;
  gymId?: number;
}

export interface UpdateEquipmentInput {
  name?: string;
  description?: string;
  categoryId?: number;
  subcategoryId?: number;
  brand?: string;
  manualUrl?: string;
  gymId?: number;
}

export interface CreateEquipmentCategoryInput {
  name: string;
  slug: string;
}

export interface CreateEquipmentSubcategoryInput {
  name: string;
  slug: string;
  categoryId: number;
}
