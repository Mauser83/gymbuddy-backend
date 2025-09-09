export interface UploadTicketInput {
  ext: string;
  contentType?: string;
  contentLength?: number;
  sha256?: string;
}

export interface GetImageUploadUrlInput {
  gymId: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
  sha256?: string;
  contentLength?: number;
  ttlSec?: number;
}

export interface PresignedUpload {
  url: string;
  key: string;
  expiresAt: string; // ISO
  expiresAtMs: number;
  alreadyUploaded: boolean;
  requiredHeaders: { name: string; value: string }[];
}