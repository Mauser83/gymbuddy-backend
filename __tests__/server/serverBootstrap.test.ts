import { jest } from '@jest/globals';

type SetupApollo = (
  app: unknown,
  prismaClient: unknown,
  permissionService: unknown,
  mediaService: unknown,
  imageIntakeService: unknown,
  imagePromotionService: unknown,
  imageModerationService: unknown,
  recognitionService: unknown,
) => Promise<void>;

type InitLocalOpenCLIP = () => Promise<void>;

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('server bootstrap behaviour', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('throws when JWT_SECRET is missing', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;

    await expect(
      jest.isolateModulesAsync(async () => {
        require('../../src/server.js');
      }),
    ).rejects.toThrow('JWT_SECRET environment variable is required');
  });

  test('boots services when not running tests', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      JWT_SECRET: 'secret',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
      PORT: '4000',
    };

    const listenMock = jest.fn((_: number, callback: () => void) => {
      callback();
    });
    const closeMock = jest.fn((callback?: () => void) => {
      callback?.();
    });

    const httpServerMock = {
      listen: listenMock,
      close: closeMock,
    } as unknown as import('http').Server;

    const createServerMock = jest.fn((_app: unknown) => httpServerMock);

    const startMemoryLogger = jest.fn();
    const setupApollo = jest.fn<SetupApollo>().mockResolvedValue(undefined);
    const setupWebSocket = jest.fn();
    const initLocalOpenCLIP = jest.fn<InitLocalOpenCLIP>().mockResolvedValue(undefined);

    const prismaClient = { client: true };
    const permissionService = { permissions: true };
    const mediaService = { media: true };
    const imageIntakeService = { intake: true };
    const imagePromotionService = { promotion: true };
    const imageModerationService = { moderation: true };
    const recognitionService = { recognition: true };

    const resolveMock = jest.fn((token: string) => {
      switch (token) {
        case 'PrismaClient':
          return prismaClient;
        case 'PermissionService':
          return permissionService;
        case 'MediaService':
          return mediaService;
        default:
          throw new Error(`Unexpected token ${token}`);
      }
    });

    const containerMock = { resolve: resolveMock };

    const ImageIntakeService = jest.fn(() => imageIntakeService);
    const ImagePromotionService = jest.fn(() => imagePromotionService);
    const ImageModerationService = jest.fn(() => imageModerationService);
    const RecognitionService = jest.fn(() => recognitionService);

    const processOnSpy = jest
      .spyOn(process, 'on')
      .mockImplementation((() => process) as unknown as typeof process.on);
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    let serverModule: typeof import('../../src/server.js') | undefined;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('http', () => {
        const actualHttp = jest.requireActual<typeof import('http')>('http');

        return {
          __esModule: true,
          ...actualHttp,
          default: { ...actualHttp, createServer: createServerMock },
          createServer: createServerMock,
        };
      });

      jest.doMock('../../src/utils/memoryTracker', () => ({
        startMemoryLogger,
      }));

      jest.doMock('../../src/graphql/setupApollo', () => ({
        setupApollo,
      }));

      jest.doMock('../../src/graphql/setupWebsocket', () => ({
        setupWebSocket,
      }));

      jest.doMock('../../src/modules/images/embedding/local-openclip-light', () => ({
        initLocalOpenCLIP,
      }));

      jest.doMock('../../src/modules/core/di.container', () => ({
        DIContainer: {
          getInstance: () => containerMock,
        },
      }));

      jest.doMock('../../src/prisma', () => ({
        PrismaClient: jest.fn(),
      }));

      jest.doMock('../../src/modules/images/image-intake.service', () => ({
        ImageIntakeService,
      }));

      jest.doMock('../../src/modules/images/image-promotion.service', () => ({
        ImagePromotionService,
      }));

      jest.doMock('../../src/modules/images/image-moderation.service', () => ({
        ImageModerationService,
      }));

      jest.doMock('../../src/modules/recognition/recognition.service', () => ({
        RecognitionService,
      }));

      serverModule = require('../../src/server.js');
    });

    expect(serverModule).toBeDefined();

    const { app } = serverModule!;
    expect(app).toBeDefined();
    await flushMicrotasks();

    expect(startMemoryLogger).toHaveBeenCalledTimes(1);
    expect(initLocalOpenCLIP).toHaveBeenCalledTimes(1);
    expect(setupApollo).toHaveBeenCalledWith(
      expect.anything(),
      prismaClient,
      permissionService,
      mediaService,
      imageIntakeService,
      imagePromotionService,
      imageModerationService,
      recognitionService,
    );
    expect(createServerMock).toHaveBeenCalledWith(expect.anything());
    expect(listenMock).toHaveBeenCalledWith('4000', expect.any(Function));
    expect(setupWebSocket).toHaveBeenCalledWith(
      httpServerMock,
      prismaClient,
      permissionService,
      mediaService,
      imageIntakeService,
      imagePromotionService,
      imageModerationService,
      recognitionService,
    );
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(consoleLogSpy).toHaveBeenCalledWith('Starting Apollo Server...');
  });

  test('logs and exits when startup fails', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      JWT_SECRET: 'secret',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    };

    const startMemoryLogger = jest.fn();
    const setupApolloError = new Error('boom');
    const setupApollo = jest.fn<SetupApollo>().mockRejectedValue(setupApolloError);

    const processExit = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'on').mockImplementation((() => process) as unknown as typeof process.on);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/utils/memoryTracker', () => ({
        startMemoryLogger,
      }));

      jest.doMock('../../src/graphql/setupApollo', () => ({
        setupApollo,
      }));

      jest.doMock('../../src/modules/images/embedding/local-openclip-light', () => ({
        initLocalOpenCLIP: jest.fn<InitLocalOpenCLIP>().mockResolvedValue(undefined),
      }));

      jest.doMock('../../src/modules/core/di.container', () => ({
        DIContainer: {
          getInstance: () => ({
            resolve: jest.fn((token: string) => ({ token })),
          }),
        },
      }));

      jest.doMock('../../src/prisma', () => ({
        PrismaClient: jest.fn(),
      }));

      jest.doMock('../../src/modules/images/image-intake.service', () => ({
        ImageIntakeService: jest.fn(() => ({})),
      }));

      jest.doMock('../../src/modules/images/image-promotion.service', () => ({
        ImagePromotionService: jest.fn(() => ({})),
      }));

      jest.doMock('../../src/modules/images/image-moderation.service', () => ({
        ImageModerationService: jest.fn(() => ({})),
      }));

      jest.doMock('../../src/modules/recognition/recognition.service', () => ({
        RecognitionService: jest.fn(() => ({})),
      }));

      require('../../src/server.js');
      await flushMicrotasks();
    });

    expect(startMemoryLogger).toHaveBeenCalledTimes(1);
    expect(setupApollo).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('❌ Failed to start server:', setupApolloError);
    expect(processExit).toHaveBeenCalledWith(1);
  });
});
