import {
    IsString,
    IsOptional,
    IsInt,
    IsNumber
  } from 'class-validator';

export class CreateExerciseDto {
    @IsString()
    name!: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsOptional()
    @IsInt()
    sets?: number;
  
    @IsOptional()
    @IsInt()
    reps?: number;
  
    @IsOptional()
    @IsNumber()
    weight?: number;
  
    @IsOptional()
    @IsInt()
    equipmentId?: number;
  }
  
  export class UpdateExerciseDto extends CreateExerciseDto {}
  