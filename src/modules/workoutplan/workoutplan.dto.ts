import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsNumber,
  ArrayMaxSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import 'reflect-metadata';

// ➕ Extended input class for structured plan exercise data
export class WorkoutPlanExerciseInputDto {
  @IsInt()
  @Min(1)
  exerciseId!: number;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  targetSets?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  targetReps?: number;

  @IsOptional()
  @IsNumber()
  targetWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  targetRpe?: number;

  @IsOptional()
  @IsInt()
  trainingMethodId?: number;

  @IsOptional()
  @IsBoolean()
  isWarmup?: boolean;
}

export class CreateWorkoutPlanDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @Length(3, 100, { message: 'Name must be between 3-100 characters' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Length(0, 500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPublic must be a boolean' })
  isPublic?: boolean;

  @IsOptional()
  @IsInt({ message: 'workoutTypeId must be an integer' })
  workoutTypeId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'Each muscleGroupId must be an integer' })
  muscleGroupIds?: number[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseInputDto)
  @ArrayMaxSize(100)
  exercises?: WorkoutPlanExerciseInputDto[];
}

export class UpdateWorkoutPlanDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Length(3, 100, { message: 'Name must be between 3-100 characters' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Length(0, 500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPublic must be a boolean' })
  isPublic?: boolean;

  @IsOptional()
  @IsInt({ message: 'workoutTypeId must be an integer' })
  workoutTypeId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'Each muscleGroupId must be an integer' })
  muscleGroupIds?: number[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseInputDto)
  @ArrayMaxSize(100)
  exercises?: WorkoutPlanExerciseInputDto[];
}
