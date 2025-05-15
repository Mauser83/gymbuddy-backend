import { IsNumber, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';

export class CreateExerciseLogDto {
  @IsNumber({}, { message: 'Exercise ID must be a number' })
  @IsNotEmpty({ message: 'Exercise ID is required' })
  exerciseId!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Workout Plan ID must be a number' })
  workoutPlanId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Gym ID must be a number' })
  gymId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Gym Equipment ID must be a number' })
  gymEquipmentId?: number; // ✅ NEW FIELD

  @IsOptional()
  @IsNumber({}, { message: 'Sets must be a number' })
  @Min(1, { message: 'Minimum 1 set required' })
  @Max(20, { message: 'Maximum 20 sets allowed' })
  sets?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Reps must be a number' })
  @Min(1, { message: 'Minimum 1 rep required' })
  @Max(100, { message: 'Maximum 100 reps allowed' })
  reps?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Weight must be a number' })
  weight?: number;
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
  gymId?: number;

  @IsOptional()
  @IsNumber()
  gymEquipmentId?: number; // ✅ NEW FIELD

  @IsOptional()
  @IsNumber()
  sets?: number;

  @IsOptional()
  @IsNumber()
  reps?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;
}
