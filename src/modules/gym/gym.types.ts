import { User } from "../user/user.types";
import type { UploadTicketInput } from "../media/media.types";

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
  id: string;          // cuid
  gymId: number;       // Int FK
  equipmentId: number; // Int FK
  storageKey: string;
  sha256?: string;
  status?: GymImageStatus;
  approvedAt?: Date;
  approvedByUserId?: number;
  approvedBy?: User;
  createdAt: Date;
  updatedAt?: Date;
  isPrimary: boolean;
  thumbUrl?: string;
  url?: string;
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

export type GymImageStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "QUARANTINED";
  
export interface UploadGymImageInput {
  gymId: number;
  equipmentId: number;
  storageKey: string;
  sha256?: string;
  status?: GymImageStatus;
}

export interface GymEquipmentImageConnection {
  items: GymEquipmentImage[];
  nextCursor: string | null;
}

export interface UploadTicket {
  putUrl: string;
  storageKey: string;
}

export interface UploadHeaderKV {
  name: string;
  value: string;
}

export interface CreateAdminUploadTicketInput {
  gymId: number;
  upload: UploadTicketInput;
  ttlSec?: number;
}

export interface AdminUploadTicket {
  url: string;
  storageKey: string;
  expiresAt: string;
  requiredHeaders: UploadHeaderKV[];
}