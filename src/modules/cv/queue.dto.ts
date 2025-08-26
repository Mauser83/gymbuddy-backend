import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export enum ImageJobStatusDto {
  pending = "pending",
  running = "running",
  failed = "failed",
  done = "done",
}

export class EnqueueImageJobDto {
  @IsString()
  imageId!: string; // cuid

  @IsString()
  jobType!: string;

  @IsOptional()
  @IsInt()
  priority?: number = 0;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateImageJobStatusDto {
  @IsString()
  id!: string;

  @IsEnum(ImageJobStatusDto)
  status!: ImageJobStatusDto;

  @IsOptional()
  @IsString()
  lastError?: string;

  @IsOptional()
  @IsInt()
  attempts?: number;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  finishedAt?: string;
}