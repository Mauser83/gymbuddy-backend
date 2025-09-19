import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

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

  @IsOptional()
  @IsString({ message: 'Brand must be a string' })
  brand?: string;

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
