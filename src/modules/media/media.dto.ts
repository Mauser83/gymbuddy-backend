import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class GetImageUploadUrlDto {
  @IsInt() @Min(1) gymId!: number;

  @IsString()
  @Matches(/^(image\/jpeg|image\/png|image\/webp)$/i, {
    message: "contentType must be image/jpeg, image/png, or image/webp",
  })
  contentType!: string;

  @IsOptional() @IsString() filename?: string;

  @IsOptional() @IsString() sha256?: string;

  @IsOptional() @IsInt() @Min(1) contentLength?: number;

  @IsOptional() @IsInt() @Min(30) ttlSec?: number; // clamp later (30..604800)
}

export class CreateUploadSessionDto {
  @IsInt() @Min(1) gymId!: number;
  @IsInt() @Min(1) count!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @Matches(/^image\//i, { each: true })
  contentTypes!: string[];

  @IsOptional() @IsString() filenamePrefix?: string;
  @IsOptional() @IsInt() equipmentId?: number;
}

export class ImageUrlManyDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  storageKeys!: string[];

  @IsOptional() @IsInt() ttlSec?: number;
}

export class ImageUrlDto {
  @IsString()
  @Matches(/^(private\/uploads\/\d+\/.*|public\/(golden|training)\/.*)$/)
  storageKey!: string;

  @IsOptional() @IsInt()
  ttlSec?: number;
}