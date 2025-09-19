export interface ImageEmbedding {
  id: string;
  imageId: string;
  scope: string;
  scopeType?: string | null;
  gymId?: number | null;
  modelVendor: string;
  modelName: string;
  modelVersion: string;
  dim: number;
  createdAt: string; // DateTime scalar mapping
}

export type LatestEmbeddedImageInput = {
  scope: 'GLOBAL' | 'GYM' | 'AUTO';
  gymId?: number;
  equipmentId?: number;
};

export type LatestEmbeddedImage = {
  imageId: string;
  createdAt: string;
  scope: 'GLOBAL' | 'GYM';
};
