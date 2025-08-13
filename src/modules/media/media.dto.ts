import { IsInt, IsOptional, IsString, Matches, Min } from "class-validator";

export class GetImageUploadUrlDto {
  @IsInt() @Min(1) gymId!: number;

  @IsString()
  @Matches(/^(image\/jpeg|image\/png|image\/webp)$/i, {
    message: "contentType must be image/jpeg, image/png, or image/webp",
  })
  contentType!: string;

  @IsOptional() @IsString() filename?: string;

  @IsOptional() @IsInt() @Min(30) ttlSec?: number; // clamp later (30..604800)
}