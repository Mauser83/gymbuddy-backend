/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  globalSetup: '<rootDir>/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/__tests__/testUtils.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/globalSetup.ts',
    '<rootDir>/__tests__/globalTeardown.ts',
    '<rootDir>/__tests__/testUtils.ts',
  ],

  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],

  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid port conflicts
  detectOpenHandles: true,
  forceExit: true,
};
