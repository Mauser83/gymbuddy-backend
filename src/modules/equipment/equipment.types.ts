import type { EquipmentSuggestionStatusDto } from './equipment.dto';
import { Exercise } from '../exercise/exercise.types';

export type EquipmentSuggestionStatus = EquipmentSuggestionStatusDto;

export interface EquipmentImage {
  id: string;
  equipmentId: number;
  storageKey: string;
  createdAt: Date;
  thumbUrl?: string | null;
  [key: string]: unknown;
}

export interface Equipment {
  id: number;
  name: string;
  description?: string | null;
  brand: string;
  manualUrl?: string | null;
  categoryId: number;
  subcategoryId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  images?: EquipmentImage[];
  // ✅ NEW: Exercises that use this equipment's subcategory
  compatibleExercises?: Exercise[];
  [key: string]: unknown;
}

export interface CreateEquipmentInput {
  name: string;
  description?: string;
  categoryId: number;
  subcategoryId?: number;
  brand: string;
  manualUrl?: string;
}

export interface EquipmentSuggestionImage {
  id: string;
  suggestionId: string;
  storageKey: string;
  sha256: string;
  contentLength: number;
  createdAt: Date;
  thumbUrl?: string | null;
  [key: string]: unknown;
}

export interface EquipmentSuggestion {
  id: string;
  gymId?: number | null;
  managerUserId: number;
  name: string;
  description?: string | null;
  brand: string;
  manualUrl?: string | null;
  categoryId: number;
  subcategoryId?: number | null;
  addToGymOnApprove: boolean;
  status: EquipmentSuggestionStatus;
  rejectedReason?: string | null;
  approvedEquipmentId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  images?: EquipmentSuggestionImage[];
  [key: string]: unknown;
}

export interface EquipmentUpdateSuggestion {
  id: string;
  equipmentId: number;
  equipment?: Equipment;
  proposedName: string;
  proposedBrand: string;
  proposedManualUrl?: string | null;
  status: EquipmentSuggestionStatus;
  rejectedReason?: string | null;
  submittedByUserId: number;
  approvedByUserId?: number | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface CreateEquipmentSuggestionInput extends CreateEquipmentInput {
  gymId?: number;
  addToGymOnApprove?: boolean;
}

export interface ListEquipmentSuggestionsInput {
  status: EquipmentSuggestionStatus;
  gymId?: number;
  categoryId?: number;
  subcategoryId?: number;
  limit?: number;
  cursor?: string;
}

export interface CreateEquipmentSuggestionPayload {
  suggestion: EquipmentSuggestion;
  nearMatches: Equipment[];
}

export interface EquipmentSuggestionConnection {
  items: EquipmentSuggestion[];
  nextCursor?: string | null;
}

export interface EquipmentSuggestionUploadTicketInput {
  suggestionId: string;
  upload: {
    ext: string;
    contentType?: string;
    contentLength?: number;
    sha256?: string;
  };
}

export interface FinalizeEquipmentSuggestionImagesInput {
  suggestionId: string;
  storageKeys: string[];
}

export interface ApproveEquipmentSuggestionInput {
  id: string;
  mergeIntoEquipmentId?: number;
}

export interface RejectEquipmentSuggestionInput {
  id: string;
  reason?: string;
}

export interface CreateEquipmentUpdateSuggestionInput {
  equipmentId: number;
  proposedName: string;
  proposedBrand: string;
  proposedManualUrl?: string;
}

export interface CreateEquipmentUpdateSuggestionPayload {
  suggestion: EquipmentUpdateSuggestion;
}

export interface ApproveEquipmentUpdateSuggestionInput {
  id: string;
}

export interface ApproveEquipmentUpdateSuggestionPayload {
  approved: boolean;
  equipmentId: number;
}

export interface RejectEquipmentUpdateSuggestionInput {
  id: string;
  reason?: string;
}

export interface RejectEquipmentUpdateSuggestionPayload {
  rejected: boolean;
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
