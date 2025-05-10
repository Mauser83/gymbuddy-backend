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
