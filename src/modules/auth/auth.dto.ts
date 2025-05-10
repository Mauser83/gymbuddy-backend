import 'reflect-metadata';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  username!: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password cannot be empty' })
  password!: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token must be a string' })
  refreshToken!: string;
}

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Token must be a string' })
  token!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
