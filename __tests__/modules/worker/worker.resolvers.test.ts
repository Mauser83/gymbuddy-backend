import type { AuthContext } from '../../../src/modules/auth/auth.types';

const AUTH_ROLES_PATH = '../../../src/modules/auth/auth.roles';
const IMAGE_WORKER_PATH = '../../../src/modules/images/image-worker.js';

jest.mock('../../../src/modules/auth/auth.roles', () => ({
  verifyRoles: jest.fn(),
}));

jest.mock('../../../src/modules/images/image-worker.js', () => ({
  runOnce: jest.fn(),
}));

describe('WorkerResolvers.runImageWorkerOnce', () => {
  let verifyRolesMock: jest.Mock;
  let runOnceMock: jest.Mock<Promise<void>, [number]>;

  const refreshMocks = () => {
    verifyRolesMock = jest.requireMock(AUTH_ROLES_PATH).verifyRoles as jest.Mock;
    runOnceMock = jest.requireMock(IMAGE_WORKER_PATH).runOnce as jest.Mock<Promise<void>, [number]>;
  };

  const loadResolvers = () => {
    jest.resetModules();
    const module = require('../../../src/modules/worker/worker.resolvers') as typeof import('../../../src/modules/worker/worker.resolvers');
    refreshMocks();
    verifyRolesMock.mockReset();
    runOnceMock.mockReset().mockResolvedValue(undefined);
    module.__resetImageWorkerState?.();
    module.__setImageWorkerLoader?.(() => Promise.resolve(jest.requireMock(IMAGE_WORKER_PATH)));
    return module;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    refreshMocks();
    verifyRolesMock.mockReset();
    runOnceMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires privileged roles and starts the worker with the provided max', async () => {
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation(((callback: (...args: unknown[]) => unknown) => {
        callback();
        return 0 as unknown as NodeJS.Immediate;
      }) as typeof setImmediate);

    const { WorkerResolvers } = loadResolvers();
    const ctx = { user: { id: 'user-1' } } as unknown as AuthContext;

    const result = await WorkerResolvers.Mutation.runImageWorkerOnce({}, { max: 5 }, ctx);

    await Promise.resolve();

    expect(verifyRolesMock).toHaveBeenCalledTimes(1);
    expect(verifyRolesMock).toHaveBeenCalledWith(ctx, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });
    expect(immediateSpy).toHaveBeenCalledTimes(1);
    expect(runOnceMock).toHaveBeenCalledWith(5);
    expect(result).toEqual({ ok: true, status: 'started' });

    immediateSpy.mockRestore();
  });

  it('returns already running when a job is in flight and allows a retry once finished', async () => {
    const scheduled: Array<() => Promise<void>> = [];
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation(((callback: (...args: unknown[]) => unknown) => {
        scheduled.push(callback as () => Promise<void>);
        return 0 as unknown as NodeJS.Immediate;
      }) as typeof setImmediate);

    const { WorkerResolvers } = loadResolvers();
    const ctx = { user: { id: 'admin' } } as unknown as AuthContext;

    const first = await WorkerResolvers.Mutation.runImageWorkerOnce({}, { max: 10 }, ctx);
    expect(first).toEqual({ ok: true, status: 'started' });
    expect(immediateSpy).toHaveBeenCalledTimes(1);
    expect(verifyRolesMock).toHaveBeenCalledTimes(1);

    const second = await WorkerResolvers.Mutation.runImageWorkerOnce({}, { max: 20 }, ctx);
    expect(second).toEqual({ ok: true, status: 'already-running' });
    expect(verifyRolesMock).toHaveBeenCalledTimes(2);
    expect(runOnceMock).not.toHaveBeenCalled();

    await scheduled[0]!();
    await Promise.resolve();
    expect(runOnceMock).toHaveBeenCalledTimes(1);
    expect(runOnceMock).toHaveBeenNthCalledWith(1, 10);

    const third = await WorkerResolvers.Mutation.runImageWorkerOnce({}, { max: 0 }, ctx);
    expect(third).toEqual({ ok: true, status: 'started' });
    expect(verifyRolesMock).toHaveBeenCalledTimes(3);

    expect(scheduled).toHaveLength(2);
    await scheduled[1]!();
    await Promise.resolve();

    expect(runOnceMock).toHaveBeenCalledTimes(2);
    expect(runOnceMock).toHaveBeenNthCalledWith(2, 1);

    immediateSpy.mockRestore();
  });

  it('logs errors from the worker and resets state for subsequent runs', async () => {
    const immediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation(((callback: (...args: unknown[]) => unknown) => {
        void (callback as () => Promise<void>)();
        return 0 as unknown as NodeJS.Immediate;
      }) as typeof setImmediate);

    const error = new Error('worker failed');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { WorkerResolvers } = loadResolvers();
    runOnceMock.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);

    const ctx = { user: { id: 'mod' } } as unknown as AuthContext;

    const first = await WorkerResolvers.Mutation.runImageWorkerOnce({}, { max: 2 }, ctx);
    expect(first).toEqual({ ok: true, status: 'started' });

    await Promise.resolve();
    expect(runOnceMock).toHaveBeenNthCalledWith(1, 2);
    expect(consoleSpy).toHaveBeenCalledWith('[image-worker] runOnce error:', error);

    const second = await WorkerResolvers.Mutation.runImageWorkerOnce({}, {}, ctx);
    expect(second).toEqual({ ok: true, status: 'started' });
    expect(runOnceMock).toHaveBeenCalledTimes(2);
    expect(runOnceMock).toHaveBeenNthCalledWith(2, 100);

    consoleSpy.mockRestore();
    immediateSpy.mockRestore();
  });
});