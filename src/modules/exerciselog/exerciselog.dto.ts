import {
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateExerciseLogDto {
  @IsNumber({}, { message: 'Exercise ID must be a number' })
  @IsNotEmpty({ message: 'Exercise ID is required' })
  exerciseId!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Workout Plan ID must be a number' })
  workoutPlanId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Workout Session ID must be a number' })
  workoutSessionId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Gym ID must be a number' })
  gymId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Gym Equipment ID must be a number' })
  gymEquipmentId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'RPE must be a number between 0 and 10' })
  @Min(0)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateExerciseLogDto {
  @IsOptional()
  @IsNumber()
  exerciseId?: number;

  @IsOptional()
  @IsNumber()
  workoutPlanId?: number;

  @IsOptional()
  @IsNumber()
  workoutSessionId?: number;

  @IsOptional()
  @IsNumber()
  gymId?: number;

  @IsOptional()
  @IsNumber()
  gymEquipmentId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
