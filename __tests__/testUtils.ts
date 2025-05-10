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
    prisma.exercise.deleteMany(),    // references: User, Equipment
    prisma.workoutPlan.deleteMany(), // references: User
    prisma.equipment.deleteMany(),   // references: Gym
    prisma.gym.deleteMany(),         // parent of gym-related models
    prisma.user.deleteMany(),        // parent of many models (Exercise, WorkoutPlan, etc.)
    prisma.auditLog.deleteMany(),    // not related directly by FK, but may reference users/entities
  ]);
};

export const executeOperation = async (operation: {
  query: string;
  variables?: Record<string, any>;
}) => {
  const { testServer } = await getUtils();
  return await testServer.executeOperation(operation);
};

export const { 
  testServer, 
  testUrl, 
  prisma 
} = (global as any).__TEST_UTILS__ || {};