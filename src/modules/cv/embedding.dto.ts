import { IsInt, IsOptional, IsString } from "class-validator";

export class UpsertImageEmbeddingDto {
  @IsOptional()
  @IsString()
  id?: string; // cuid

  @IsString()
  imageId!: string; // cuid

  @IsString()
  scope!: string;

  @IsString()
  modelVendor!: string;

  @IsString()
  modelName!: string;

  @IsString()
  modelVersion!: string;

  @IsInt()
  dim!: number;
  // NOTE: vector not in DTO; write via service from a trusted caller
}

export class GetImageEmbeddingsByImageDto {
  @IsString()
  imageId!: string; // cuid

  @IsOptional()
  @IsString()
  scope?: string;
}

export class LatestEmbeddedImageInputDTO {
  @IsString()
  scope!: 'GLOBAL' | 'GYM' | 'AUTO';

  @IsOptional()
  @IsInt()
  gymId?: number;

  @IsOptional()
  @IsInt()
  equipmentId?: number;
}

export class LatestEmbeddedImageDTO {
  imageId!: string;
  createdAt!: Date;
  scope!: 'GLOBAL' | 'GYM';
}