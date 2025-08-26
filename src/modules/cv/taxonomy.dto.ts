import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export enum TaxonomyKindDto {
  ANGLE = "ANGLE",
  HEIGHT = "HEIGHT",
  LIGHTING = "LIGHTING",
  MIRROR = "MIRROR",
  DISTANCE = "DISTANCE",
  SOURCE = "SOURCE",
  SPLIT = "SPLIT",
}

export class KindParamDto {
  @IsEnum(TaxonomyKindDto)
  kind!: TaxonomyKindDto;
}

export class CreateTaxonomyInputDto {
  @IsString()
  key!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class CreateTaxonomyDto extends CreateTaxonomyInputDto {
  @IsEnum(TaxonomyKindDto)
  kind!: TaxonomyKindDto;
}

export class UpdateTaxonomyInputDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateTaxonomyDto extends UpdateTaxonomyInputDto {
  @IsEnum(TaxonomyKindDto)
  kind!: TaxonomyKindDto;

  @IsInt()
  id!: number;
}

export class IdParamDto extends KindParamDto {
  @IsInt()
  id!: number;
}

export class ReorderItemDto {
  @IsInt()
  id!: number;

  @IsInt()
  displayOrder!: number;
}

export class ReorderTaxonomyDto extends KindParamDto {
  items!: ReorderItemDto[];
}