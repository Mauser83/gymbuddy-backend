import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class FinalizeGymImageDto {
  @IsString() storageKey!: string;

  @IsInt() @Min(1) gymId!: number;
  @IsInt() @Min(1) equipmentId!: number;

  // sha256 (optional; hex)
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i, { message: "sha256 must be a 64-char hex string" })
  sha256?: string;

  // optional taxonomy FKs
  @IsOptional() @IsInt() angleId?: number;
  @IsOptional() @IsInt() heightId?: number;
  @IsOptional() @IsInt() lightingId?: number;
  @IsOptional() @IsInt() mirrorId?: number;
  @IsOptional() @IsInt() distanceId?: number;
  @IsOptional() @IsInt() sourceId?: number;
  @IsOptional() @IsInt() splitId?: number;
}

export class PromoteGymImageDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsInt()
  splitId?: number;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ApproveGymImageDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsInt()
  splitId?: number;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class RejectGymImageDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  deleteObject?: boolean;
}

export class CandidateGlobalImagesDto {
  @IsInt()
  equipmentId!: number;

  @IsOptional()
  @IsInt()
  limit?: number;
}

export class GymImageDefaultsDto {
  @IsInt() @Min(1) gymId!: number;
  @IsInt() @Min(1) equipmentId!: number;
  @IsOptional() @IsInt() sourceId?: number;
  @IsOptional() @IsInt() splitId?: number;
  @IsOptional() @IsInt() lightingId?: number;
}

export class FinalizeGymImageItemDto {
  @IsString() storageKey!: string;
  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/i, { message: "sha256 must be a 64-char hex string" })
  sha256?: string;
  @IsOptional() @IsInt() angleId?: number;
  @IsOptional() @IsInt() heightId?: number;
  @IsOptional() @IsInt() distanceId?: number;
  @IsOptional() @IsInt() mirrorId?: number;
  @IsOptional() @IsInt() lightingId?: number;
  @IsOptional() @IsInt() splitId?: number;
  @IsOptional() @IsInt() sourceId?: number;
}

export class FinalizeGymImagesDto {
  @IsOptional() @IsString() sessionId?: string;
  defaults!: GymImageDefaultsDto;
  @IsArray()
  @ArrayMinSize(1)
  items!: FinalizeGymImageItemDto[];
}

export class ApplyTaxonomiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imageIds!: string[];
  @IsOptional() @IsInt() angleId?: number;
  @IsOptional() @IsInt() heightId?: number;
  @IsOptional() @IsInt() distanceId?: number;
  @IsOptional() @IsInt() lightingId?: number;
  @IsOptional() @IsInt() mirrorId?: number;
  @IsOptional() @IsInt() splitId?: number;
  @IsOptional() @IsInt() sourceId?: number;
}