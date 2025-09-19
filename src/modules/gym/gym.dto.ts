import {
  IsString,
  IsOptional,
  IsLatitude,
  IsLongitude,
  IsEmail,
  IsUrl,
  IsInt,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateGymDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  stateCode?: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  websiteUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}

export class UpdateGymDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  stateCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  websiteUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(200)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}

// --- New DTOs ---

export class AssignEquipmentToGymDto {
  @IsInt()
  gymId!: number;

  @IsInt()
  equipmentId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateGymEquipmentDto {
  @IsInt()
  gymEquipmentId!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export enum GymImageStatusDto {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  QUARANTINED = 'QUARANTINED',
}

export class UploadGymImageDto {
  @IsInt({ message: 'gymId must be an integer' })
  gymId!: number;

  @IsInt({ message: 'equipmentId must be an integer' })
  equipmentId!: number;

  @IsString({ message: 'storageKey must be a string' })
  storageKey!: string;

  @IsOptional()
  @IsString({ message: 'sha256 must be a string' })
  sha256?: string;

  @IsOptional()
  @IsEnum(GymImageStatusDto, {
    message: 'status must be PENDING | APPROVED | REJECTED | QUARANTINED',
  })
  status?: GymImageStatusDto;
}

export class DeleteGymImageDto {
  @IsString({ message: 'imageId must be a string cuid' })
  imageId!: string;
}
