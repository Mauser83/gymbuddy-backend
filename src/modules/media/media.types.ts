export interface GetImageUploadUrlInput {
  gymId: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
  ttlSec?: number;
}

export interface PresignedUpload {
  url: string;
  key: string;
  expiresAt: string; // ISO
  requiredHeaders: { name: string; value: string }[];
}