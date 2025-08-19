import { PrismaClient, User } from "../../lib/prisma";
import { PermissionService } from "../core/permission.service";
import { MediaService } from "../media/media.service";
import { ImageIntakeService } from "../images/image-intake.service";
import { ImagePromotionService } from "../images/image-promotion.service";
import { ImageModerationService } from "../images/image-moderation.service";

// Existing GraphQL-related types
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ✅ Consolidated Role + Context Types
export enum AppRole {
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

export enum UserRole {
  USER = "USER",
  PREMIUM_USER = "PREMIUM_USER",
  PERSONAL_TRAINER = "PERSONAL_TRAINER",
}

export enum GymRole {
  GYM_ADMIN = "GYM_ADMIN",
  GYM_MODERATOR = "GYM_MODERATOR",
}

export enum PermissionType {
  OWNERSHIP = "OWNERSHIP",
  GYM_SCOPE = "GYM_SCOPE",
  APP_SCOPE = "APP_SCOPE",
  PREMIUM_FEATURE = "PREMIUM_FEATURE",
}

export interface JwtPayload {
  userId: number;
  appRole?: AppRole;
  gymRoles?: Record<number, GymRole>;
}

export interface AuthContext {
  userId: number | null;
  appRole?: AppRole;
  userRole: UserRole;
  gymRoles: {
    gymId: number;
    role: GymRole;
  }[];
  isPremium: boolean;
  prisma: PrismaClient;
  permissionService: PermissionService;
  mediaService: MediaService;
  imageIntakeService: ImageIntakeService;
  imagePromotionService: ImagePromotionService;
  imageModerationService: ImageModerationService;
}
