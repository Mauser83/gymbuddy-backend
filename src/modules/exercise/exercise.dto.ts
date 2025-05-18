import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // ➕ NEW: optional list of equipment IDs to attach
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  equipmentIds?: number[];
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  equipmentIds?: number[];
}
