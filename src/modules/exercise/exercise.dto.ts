import { Type } from 'class-transformer';
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
import 'reflect-metadata';

export class CreateExerciseDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsInt()
  difficultyId!: number;

  @IsInt()
  exerciseTypeId!: number;

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

export class CreateExerciseTypeMetricDto {
  @IsInt()
  metricId!: number;

  @IsInt()
  order!: number;
}

export class CreateExerciseTypeDto {
  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseTypeMetricDto)
  metrics!: CreateExerciseTypeMetricDto[];
}

export class UpdateExerciseTypeDto {
  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseTypeMetricDto)
  metrics!: CreateExerciseTypeMetricDto[];
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

export class CreateMetricDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsString()
  unit!: string;

  @IsString()
  inputType!: string; // e.g., "number", "time", "text"

  @IsOptional()
  @IsBoolean()
  useInPlanning?: boolean;

  @IsOptional()
  @IsBoolean()
  minOnly?: boolean;
}

export class UpdateMetricDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  inputType?: string;

  @IsOptional()
  @IsBoolean()
  useInPlanning?: boolean;

  @IsOptional()
  @IsBoolean()
  minOnly?: boolean;
}
