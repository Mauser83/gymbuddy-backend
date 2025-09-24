const useServerMock = jest.fn();

jest.mock('graphql-ws/use/ws', () => ({
  useServer: useServerMock,
}));

const makeExecutableSchemaMock = jest.fn().mockReturnValue('schema');

jest.mock('@graphql-tools/schema', () => ({
  makeExecutableSchema: makeExecutableSchemaMock,
}));

const wsInstances: Array<{
  options: any;
  handlers: Record<string, (...args: any[]) => void>;
}> = [];

const WebSocketServerMock = jest.fn((options: any) => {
  const instance = {
    options,
    handlers: {} as Record<string, (...args: any[]) => void>,
    on(event: string, handler: (...args: any[]) => void) {
      this.handlers[event] = handler;
    },
  };
  wsInstances.push(instance);
  return instance;
});

jest.mock('ws', () => ({
  WebSocketServer: WebSocketServerMock,
}));

const verifyMock = jest.fn();

jest.mock('jsonwebtoken', () => ({
  verify: verifyMock,
}));

jest.mock('../../../src/server', () => ({
  JWT_SECRET: 'ws-secret',
}));

describe('setupWebSocket', () => {
  const basePrisma = { user: { findUnique: jest.fn() } } as any;
  const permissionService = { name: 'perm' } as any;
  const mediaService = { name: 'media' } as any;
  const intakeService = { name: 'intake' } as any;
  const promotionService = { name: 'promo' } as any;
  const moderationService = { name: 'moderation' } as any;
  const recognitionService = { name: 'recognition' } as any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    wsInstances.length = 0;
    basePrisma.user.findUnique.mockReset();
  });

  function initServer() {
    const { setupWebSocket } = require('../../../src/graphql/setupWebsocket');
    setupWebSocket(
      {},
      basePrisma,
      permissionService,
      mediaService,
      intakeService,
      promotionService,
      moderationService,
      recognitionService,
    );
    expect(WebSocketServerMock).toHaveBeenCalledTimes(1);
    expect(useServerMock).toHaveBeenCalledTimes(1);
    const serverConfig = WebSocketServerMock.mock.calls[0][0] as {
      verifyClient: (info: Record<string, unknown>, cb: (...args: any[]) => void) => void;
    };
    const useServerConfig = useServerMock.mock.calls[0][0] as {
      context: (ctx: Record<string, any>) => Promise<Record<string, any>>;
    };

    return {
      verifyClient: serverConfig.verifyClient,
      contextFactory: useServerConfig.context,
    };
  }

  it('allows trusted websocket origins and rejects others', () => {
    const { verifyClient } = initServer();
    const ok = jest.fn();
    verifyClient({ origin: 'https://gymbuddy-backend-i9je.onrender.com' }, ok);
    expect(ok).toHaveBeenCalledWith(true);

    const localhost = jest.fn();
    verifyClient({ origin: 'http://localhost:3000' }, localhost);
    expect(localhost).toHaveBeenCalledWith(true);

    const denied = jest.fn();
    verifyClient({ origin: 'https://malicious.example' }, denied);
    expect(denied).toHaveBeenCalledWith(false, 401, 'Unauthorized origin');

    const missing = jest.fn();
    verifyClient({ origin: undefined }, missing);
    expect(missing).toHaveBeenCalledWith(true);
  });

  it('creates an anonymous context when no bearer token is provided', async () => {
    const { contextFactory } = initServer();

    const ctx = await contextFactory({ connectionParams: {} });
    expect(ctx).toMatchObject({
      userId: null,
      appRole: undefined,
      userRole: 'USER',
      gymRoles: [],
      isPremium: false,
      prisma: basePrisma,
      permissionService,
      mediaService,
      imageIntakeService: intakeService,
      imagePromotionService: promotionService,
      imageModerationService: moderationService,
    });
    expect(ctx).not.toHaveProperty('recognitionService');
  });

  it('authenticates websocket connections with valid tokens', async () => {
    verifyMock.mockReturnValue({
      sub: '42',
      tokenVersion: 7,
      appRole: 'ADMIN',
      userRole: 'COACH',
      gymRoles: ['lead'],
      isPremium: true,
    });
    basePrisma.user.findUnique.mockResolvedValue({ tokenVersion: 7 });

    const { contextFactory } = initServer();

    const ctx = await contextFactory({
      connectionParams: { authorization: 'Bearer ws-token' },
    });

    expect(verifyMock).toHaveBeenCalledWith('ws-token', 'ws-secret');
    expect(basePrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { tokenVersion: true },
    });
    expect(ctx).toMatchObject({
      userId: 42,
      appRole: 'ADMIN',
      userRole: 'COACH',
      gymRoles: ['lead'],
      isPremium: true,
      recognitionService,
    });
  });

  it('rejects tokens whose version no longer matches the database', async () => {
    verifyMock.mockReturnValue({ sub: '9', tokenVersion: 1 });
    basePrisma.user.findUnique.mockResolvedValue({ tokenVersion: 2 });

    const { contextFactory } = initServer();

    await expect(
      contextFactory({ connectionParams: { authorization: 'Bearer stale' } }),
    ).rejects.toThrow('Invalid or expired token');
  });
});
