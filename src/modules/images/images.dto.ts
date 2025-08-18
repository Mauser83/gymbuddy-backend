+14
-1

import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

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