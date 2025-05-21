import {
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
} from 'class-validator';

export class CreateExerciseLogDto {
  @IsInt()
  @IsNotEmpty()
  exerciseId!: number;

  @IsInt()
  @IsNotEmpty()
  gymEquipmentId!: number;

  @IsInt()
  @IsNotEmpty()
  workoutSessionId!: number;

  @IsInt()
  @IsNotEmpty()
  setNumber!: number;

  @IsInt()
  @IsNotEmpty()
  reps!: number;

  @IsNumber()
  @IsNotEmpty()
  weight!: number;

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

export class UpdateExerciseLogDto {
  @IsOptional()
  @IsInt()
  setNumber?: number;

  @IsOptional()
  @IsInt()
  reps?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

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
