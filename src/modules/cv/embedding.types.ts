export interface ImageEmbedding {
  id: string;
  imageId: string;
  scope: string;
  modelVendor: string;
  modelName: string;
  modelVersion: string;
  dim: number;
  createdAt: string; // DateTime scalar mapping
}