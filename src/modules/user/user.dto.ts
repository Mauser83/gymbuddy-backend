import { IsEmail, IsOptional, IsString, MaxLength, IsEnum, IsInt } from 'class-validator';
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

export class UpdateUserTrainingPreferencesDto {
  @IsOptional()
  trainingGoalId?: number;

  @IsOptional()
  @IsInt()
  experienceLevelId?: number;
}