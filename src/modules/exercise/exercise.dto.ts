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
  IsEnum,
} from 'class-validator';
import 'reflect-metadata';

import type { ExerciseSuggestion } from './exercise.types';
import {
  ExerciseSuggestionStatus as PrismaExerciseSuggestionStatusEnum,
  type ExerciseSuggestionStatus as PrismaExerciseSuggestionStatus,
} from '../../prisma';

export const ExerciseSuggestionStatusDto = PrismaExerciseSuggestionStatusEnum;
export type ExerciseSuggestionStatusDto = PrismaExerciseSuggestionStatus;

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
// ✨ Suggestion DTOs
// ----------------------

export class ExerciseSuggestionSlotOptionDto extends CreateExerciseSlotOptionDto {}

export class ExerciseSuggestionSlotDto extends CreateExerciseSlotDto {}

export class ExerciseSuggestionCreateDto extends CreateExerciseDto {}

export class CreateExerciseSuggestionDto {
  @ValidateNested()
  @Type(() => ExerciseSuggestionCreateDto)
  exercise!: ExerciseSuggestionCreateDto;

  @IsOptional()
  @IsInt()
  gymId?: number | null;
}

export class ApproveExerciseSuggestionDto {
  @IsString()
  id!: string;
}

export class RejectExerciseSuggestionDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  reason?: string | null;
}

export class ListExerciseSuggestionsDto {
  @IsEnum(ExerciseSuggestionStatusDto, { message: 'Invalid status' })
  status!: ExerciseSuggestionStatusDto;

  @IsOptional()
  @IsInt()
  limit?: number | null;

  @IsOptional()
  @IsString()
  cursor?: string | null;
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

// ----------------------
// ✨ Suggestion Interfaces
// ----------------------

export interface ExerciseSuggestionSlotOptionInput {
  subcategoryId: number;
}

export interface ExerciseSuggestionSlotInput {
  slotIndex: number;
  isRequired: boolean;
  comment?: string;
  options: ExerciseSuggestionSlotOptionInput[];
}

export interface ExerciseSuggestionCreateInput {
  name: string;
  description?: string;
  videoUrl?: string;
  difficultyId: number;
  exerciseTypeId: number;
  primaryMuscleIds: number[];
  secondaryMuscleIds?: number[];
  equipmentSlots: ExerciseSuggestionSlotInput[];
}

export interface CreateExerciseSuggestionInput {
  exercise: ExerciseSuggestionCreateInput;
  gymId?: number | null;
}

export interface CreateExerciseSuggestionPayload {
  id: string;
  status: ExerciseSuggestionStatusDto;
}

export interface ApproveExerciseSuggestionInput {
  id: string;
}

export interface ApproveExerciseSuggestionPayload {
  approved: boolean;
  exerciseId: number;
}

export interface RejectExerciseSuggestionInput {
  id: string;
  reason?: string | null;
}

export interface RejectExerciseSuggestionPayload {
  rejected: boolean;
}

export interface ListExerciseSuggestionsInput {
  status: ExerciseSuggestionStatusDto;
  limit?: number | null;
  cursor?: string | null;
}

export interface ListExerciseSuggestionsPayload {
  items: ExerciseSuggestion[];
  nextCursor?: string | null;
}
