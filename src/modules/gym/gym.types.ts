export interface Gym {
  id: number;
  name: string;
  description?: string;
  country: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city: string;
  address: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string;
  imageUrl?: string;
  phone?: string;
  email?: string;
  isApproved: boolean;
  creatorId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateGymInput {
  name: string;
  description?: string;
  country: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city: string;
  address: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string;
  imageUrl?: string;
  phone?: string;
  email?: string;
}

export interface UpdateGymInput {
  name?: string;
  description?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string;
  imageUrl?: string;
  phone?: string;
  email?: string;
}

// --- New Relational Types ---

export interface GymEquipment {
  id: number;
  gymId: number;
  equipmentId: number;
  quantity: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  images: GymEquipmentImage[];
}

export interface GymEquipmentImage {
  id: string;
  gymEquipmentId: number;
  gymId: number;
  equipmentId: number;
  imageId: string;
  capturedAt: Date;
}

// --- Inputs ---

export interface AssignEquipmentToGymInput {
  gymId: number;
  equipmentId: number;
  quantity: number;
  note?: string;
}

export interface UpdateGymEquipmentInput {
  gymEquipmentId: number;
  quantity?: number;
  note?: string;
}

export interface UploadGymEquipmentImageInput {
  gymEquipmentId: number;
  gymId: number;
  equipmentId: number;
  imageId: string;
}