import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  ArrayNotEmpty,
  ArrayUnique,
  IsUrl,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExerciseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  difficultyId?: number;

  @IsOptional()
  @IsInt()
  exerciseTypeId?: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  primaryMuscleIds!: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  secondaryMuscleIds?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseSlotDto)
  equipmentSlots!: CreateExerciseSlotDto[];
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  difficultyId?: number;

  @IsOptional()
  @IsInt()
  exerciseTypeId?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  primaryMuscleIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  secondaryMuscleIds?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseSlotDto)
  equipmentSlots?: CreateExerciseSlotDto[];
}

// ----------------------
// ✨ New Nested DTOs
// ----------------------

export class CreateExerciseSlotDto {
  @IsInt()
  slotIndex!: number;

  @IsBoolean()
  isRequired!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseSlotOptionDto)
  options!: CreateExerciseSlotOptionDto[];
}

export class CreateExerciseSlotOptionDto {
  @IsInt()
  subcategoryId!: number;
}

// ----------------------
// ✨ Reference DTOs
// ----------------------

export class CreateExerciseTypeDto {
  @IsString()
  name!: string;
}

export class UpdateExerciseTypeDto {
  @IsString()
  name!: string;
}

export class CreateExerciseDifficultyDto {
  @IsString()
  level!: string;
}

export class UpdateExerciseDifficultyDto {
  @IsString()
  level!: string;
}

export class CreateBodyPartDto {
  @IsString()
  name!: string;
}

export class UpdateBodyPartDto {
  @IsString()
  name!: string;
}

export class CreateMuscleDto {
  @IsString()
  name!: string;

  @IsInt()
  bodyPartId!: number;
}

export class UpdateMuscleDto {
  @IsString()
  name!: string;

  @IsInt()
  bodyPartId!: number;
}
