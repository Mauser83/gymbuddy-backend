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
} from "class-validator";
import { Type } from "class-transformer";
import "reflect-metadata";

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
  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Name is required" })
  @Length(3, 100, { message: "Name must be between 3-100 characters" })
  name!: string;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @Length(0, 500, { message: "Description cannot exceed 500 characters" })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: "isPublic must be a boolean" })
  isPublic?: boolean;

  @IsOptional()
  @IsInt({ message: "workoutTypeId must be an integer" })
  workoutTypeId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: "Each muscleGroupId must be an integer" })
  muscleGroupIds?: number[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseInputDto)
  @ArrayMaxSize(100)
  exercises?: WorkoutPlanExerciseInputDto[];
}

export class UpdateWorkoutPlanDto {
  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Name is required" })
  @Length(3, 100, { message: "Name must be between 3-100 characters" })
  name!: string;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @Length(0, 500, { message: "Description cannot exceed 500 characters" })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: "isPublic must be a boolean" })
  isPublic?: boolean;

  @IsInt({ message: "workoutTypeId must be an integer" })
  workoutTypeId!: number;

  @IsArray()
  @IsInt({ each: true, message: "Each muscleGroupId must be an integer" })
  muscleGroupIds!: number[];

  @ValidateNested({ each: true })
  @Type(() => WorkoutPlanExerciseInputDto)
  @ArrayMaxSize(100)
  exercises!: WorkoutPlanExerciseInputDto[];
}

// 🔁 Workout Program DTOs

export class CreateWorkoutProgramDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class UpdateWorkoutProgramDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

export class CreateWorkoutProgramDayDto {
  @IsInt()
  programId!: number;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  workoutPlanId!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class UpdateWorkoutProgramDayDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  workoutPlanId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class CreateWorkoutProgramCooldownDto {
  @IsInt()
  programId!: number;

  @IsInt()
  muscleGroupId!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  daysRequired!: number;
}

export class CreateWorkoutProgramAssignmentDto {
  @IsInt()
  userId!: number;

  @IsInt()
  programDayId!: number;

  @IsString()
  scheduledDate!: string;

  @IsOptional()
  @IsString()
  overrideDate?: string;
}

export class SetUserWorkoutPreferencesDto {
  @IsArray()
  @IsInt({ each: true })
  preferredWorkoutDays!: number[];

  @IsArray()
  @IsInt({ each: true })
  preferredRestDays!: number[];

  @IsOptional()
  @IsBoolean()
  autoReschedule?: boolean;
}

export class CreateMuscleGroupDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  slug!: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  bodyPartIds?: number[]; // ✅ supports relation to body parts
}

export class UpdateMuscleGroupDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  slug?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  bodyPartIds?: number[]; // ✅ update body part linkage
}

export class CreateWorkoutTypeDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  slug!: string;

  @IsArray()
  @IsInt({ each: true })
  categoryIds!: number[];
}

export class UpdateWorkoutTypeDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  slug?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];
}
