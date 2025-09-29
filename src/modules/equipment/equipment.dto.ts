import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  EquipmentSuggestionStatus as PrismaEquipmentSuggestionStatusEnum,
  type EquipmentSuggestionStatus as PrismaEquipmentSuggestionStatus,
} from '../../prisma';
import { UploadTicketDto } from '../media/media.dto';

export const EquipmentSuggestionStatusDto = PrismaEquipmentSuggestionStatusEnum;
export type EquipmentSuggestionStatusDto = PrismaEquipmentSuggestionStatus;

// --- Equipment DTOs ---

export class CreateEquipmentDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsString({ message: 'Brand must be a string' })
  @IsNotEmpty({ message: 'Brand is required' })
  brand!: string;

  @IsOptional()
  @IsString({ message: 'Manual URL must be a string' })
  manualUrl?: string;

  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be a positive number' })
  categoryId!: number;

  @IsOptional()
  @IsInt({ message: 'Subcategory ID must be an integer' })
  @Min(1, { message: 'Subcategory ID must be a positive number' })
  subcategoryId?: number;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsString({ message: 'Brand must be a string' })
  @IsNotEmpty({ message: 'Brand is required' })
  brand!: string;

  @IsOptional()
  @IsString({ message: 'Manual URL must be a string' })
  manualUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be a positive number' })
  categoryId?: number;

  @IsOptional()
  @IsInt({ message: 'Subcategory ID must be an integer' })
  @Min(1, { message: 'Subcategory ID must be a positive number' })
  subcategoryId?: number;
}

// --- Equipment Image DTO ---

export class UploadEquipmentImageDto {
  @IsInt({ message: 'equipmentId must be an integer' })
  equipmentId!: number;

  @IsString({ message: 'storageKey must be a string' })
  storageKey!: string;

  @IsOptional()
  @IsString({ message: 'sha256 must be a string' })
  sha256?: string;
}

export class DeleteEquipmentImageDto {
  @IsString({ message: 'imageId must be a string cuid' })
  imageId!: string;
}

// --- Category DTOs ---

export class CreateEquipmentCategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  slug!: string;
}

export class UpdateEquipmentCategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  slug!: string;
}

// --- Subcategory DTOs ---

export class CreateEquipmentSubcategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  slug!: string;

  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be a positive number' })
  categoryId!: number;
}

export class UpdateEquipmentSubcategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  slug!: string;
}

export class CreateEquipmentSuggestionDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'Brand must be a string' })
  brand?: string;

  @IsOptional()
  @IsString({ message: 'Manual URL must be a string' })
  manualUrl?: string;

  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be a positive number' })
  categoryId!: number;

  @IsOptional()
  @IsInt({ message: 'Subcategory ID must be an integer' })
  @Min(1, { message: 'Subcategory ID must be a positive number' })
  subcategoryId?: number;

  @IsOptional()
  @IsInt({ message: 'Gym ID must be an integer' })
  @Min(1, { message: 'Gym ID must be a positive number' })
  gymId?: number;

  @IsOptional()
  @IsBoolean({ message: 'addToGymOnApprove must be a boolean' })
  addToGymOnApprove?: boolean;
}

export class ListEquipmentSuggestionsDto {
  @IsEnum(EquipmentSuggestionStatusDto, { message: 'Invalid status' })
  status!: EquipmentSuggestionStatusDto;

  @IsOptional()
  @IsInt({ message: 'Gym ID must be an integer' })
  @Min(1, { message: 'Gym ID must be positive' })
  gymId?: number;

  @IsOptional()
  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be positive' })
  categoryId?: number;

  @IsOptional()
  @IsInt({ message: 'Subcategory ID must be an integer' })
  @Min(1, { message: 'Subcategory ID must be positive' })
  subcategoryId?: number;

  @IsOptional()
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be positive' })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'Cursor must be a string' })
  cursor?: string;
}

export class CreateEquipmentSuggestionUploadTicketDto {
  @IsString({ message: 'suggestionId must be a string' })
  suggestionId!: string;

  @ValidateNested()
  @Type(() => UploadTicketDto)
  upload!: UploadTicketDto;
}

export class FinalizeEquipmentSuggestionImagesDto {
  @IsString({ message: 'suggestionId must be a string' })
  suggestionId!: string;

  @IsArray({ message: 'storageKeys must be an array' })
  @ArrayNotEmpty({ message: 'storageKeys must include at least one item' })
  @Type(() => String)
  storageKeys!: string[];
}

export class ApproveEquipmentSuggestionDto {
  @IsString({ message: 'id must be a string' })
  id!: string;

  @IsOptional()
  @IsInt({ message: 'mergeIntoEquipmentId must be an integer' })
  @Min(1, { message: 'mergeIntoEquipmentId must be positive' })
  mergeIntoEquipmentId?: number;
}

export class RejectEquipmentSuggestionDto {
  @IsString({ message: 'id must be a string' })
  id!: string;

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  reason?: string;
}