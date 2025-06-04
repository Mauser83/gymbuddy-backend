import {
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  IsDateString,
} from "class-validator";

export class CreateExerciseLogDto {
  @IsInt()
  @IsNotEmpty()
  exerciseId!: number;

  @IsInt()
  @IsNotEmpty()
  workoutSessionId!: number;

  @IsInt()
  @IsNotEmpty()
  setNumber!: number;

  @IsNotEmpty()
  metrics!: Record<number, number | string>; // ✅

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsNotEmpty()
  @IsInt({ each: true })
  equipmentIds!: number[];
}

export class UpdateExerciseLogDto {
  @IsOptional()
  @IsInt()
  setNumber?: number;

  @IsOptional()
  metrics?: Record<number, number | string>; // ✅

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsInt({ each: true })
  equipmentIds?: number[];
}

// ⬇️ Add these new DTOs for WorkoutSession

export class CreateWorkoutSessionDto {
  @IsInt()
  @IsNotEmpty()
  userId!: number;

  @IsInt()
  @IsNotEmpty()
  gymId!: number;

  @IsDateString()
  @IsNotEmpty()
  startedAt!: string;

  @IsOptional()
  @IsInt()
  workoutPlanId?: number;

  @IsOptional()
  @IsInt()
  assignedWorkoutId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateWorkoutSessionDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
