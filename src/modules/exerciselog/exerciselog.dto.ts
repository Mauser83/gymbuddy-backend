import { IsNumber, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';

export class CreateExerciseLogDto {
  @IsNumber({}, { message: 'Exercise ID must be a number' })
  @IsNotEmpty({ message: 'Exercise ID is required' })
  exerciseId!: number;

  @IsNumber({}, { message: 'Workout Plan ID must be a number' })
  @IsOptional()
  workoutPlanId?: number;

  @IsNumber({}, { message: 'Gym ID must be a number' })
  @IsOptional()
  gymId?: number;

  @IsNumber({}, { message: 'Sets must be a number' })
  @IsOptional()
  @Min(1, { message: 'Minimum 1 set required' })
  @Max(20, { message: 'Maximum 20 sets allowed' })
  sets?: number;

  @IsNumber({}, { message: 'Reps must be a number' })
  @IsOptional()
  @Min(1, { message: 'Minimum 1 rep required' })
  @Max(100, { message: 'Maximum 100 reps allowed' })
  reps?: number;

  @IsNumber({}, { message: 'Weight must be a number' })
  @IsOptional()
  weight?: number;
}

export class UpdateExerciseLogDto {
  @IsNumber()
  @IsOptional()
  exerciseId?: number;

  @IsNumber()
  @IsOptional()
  workoutPlanId?: number;

  @IsNumber()
  @IsOptional()
  gymId?: number;

  @IsNumber()
  @IsOptional()
  sets?: number;

  @IsNumber()
  @IsOptional()
  reps?: number;

  @IsNumber()
  @IsOptional()
  weight?: number;
}
