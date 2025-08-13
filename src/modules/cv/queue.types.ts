export type ImageJobStatus = "pending" | "running" | "failed" | "done";

export interface ImageQueue {
  id: string;
  imageId: string;
  jobType: string;
  status: ImageJobStatus;
  priority: number;
  attempts: number;
  lastError?: string;
  scheduledAt?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}