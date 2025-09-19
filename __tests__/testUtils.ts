jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { PermissionService } from '../src/modules/core/permission.service';
import { UserRole } from '../src/modules/auth/auth.types';
import { MediaService } from '../src/modules/media/media.service';
import { ImageIntakeService } from '../src/modules/images/image-intake.service';
import { ImagePromotionService } from '../src/modules/images/image-promotion.service';
import { ImageModerationService } from '../src/modules/images/image-moderation.service';
import { RecognitionService } from '../src/modules/recognition/recognition.service';

async function getUtils() {
  const utils = (global as any).__TEST_UTILS__;
  if (!utils) {
    throw new Error('Test utilities not initialized. Make sure globalSetup ran correctly.');
  }
  return utils;
}

export const cleanDB = async () => {
  const { prisma } = await getUtils();

  // Delete in proper order to respect foreign key constraints
  await prisma.$transaction([
    prisma.gymChatMember.deleteMany(),
    prisma.gymTrainer.deleteMany(),
    prisma.gymManagementRole.deleteMany(),
    prisma.exerciseLog.deleteMany(), // references: Exercise, User, WorkoutPlan, Gym
    prisma.exercise.deleteMany(), // references: User, Equipment
    prisma.workoutPlan.deleteMany(), // references: User
    prisma.equipmentImage.deleteMany(),
    prisma.gymEquipmentImage.deleteMany(),
    prisma.gymEquipment.deleteMany(),
    prisma.equipment.deleteMany(), // references: Gym
    prisma.equipmentSubcategory.deleteMany(),
    prisma.equipmentCategory.deleteMany(),
    prisma.gym.deleteMany(), // parent of gym-related models
    prisma.user.deleteMany(), // parent of many models (Exercise, WorkoutPlan, etc.)
    prisma.auditLog.deleteMany(), // not related directly by FK, but may reference users/entities
  ]);
};

export const executeOperation = async (operation: {
  query: string;
  variables?: Record<string, any>;
}) => {
  const { testServer, prisma } = await getUtils();
  const contextValue = {
    prisma,
    userId: 1,
    userRole: UserRole.USER,
    appRole: undefined,
    gymRoles: [],
    isPremium: true,
    permissionService: new PermissionService(prisma),
    mediaService: {} as MediaService,
    imageIntakeService: {} as ImageIntakeService,
    imagePromotionService: {} as ImagePromotionService,
    imageModerationService: {} as ImageModerationService,
    recognitionService: {} as RecognitionService,
  };
  return await testServer.executeOperation(operation, { contextValue });
};

export const { testServer, testUrl, prisma } = (global as any).__TEST_UTILS__ || {};
