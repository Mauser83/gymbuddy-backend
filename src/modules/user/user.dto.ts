import { IsEmail, IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { AppRole, UserRole } from '../../lib/prisma'; // Adjust path if needed

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class UpdateUserRolesDto {
  @IsString()
  userRole!: UserRole;

  @IsOptional()
  @IsEnum(AppRole)
  appRole?: AppRole;
}

export enum ExperienceLevel {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
}

export class UpdateUserTrainingPreferencesDto {
  @IsOptional()
  trainingGoalId?: number;

  @IsOptional()
  @IsEnum(ExperienceLevel, {
    message: "experienceLevel must be BEGINNER, INTERMEDIATE, or ADVANCED",
  })
  experienceLevel?: ExperienceLevel;
}