import { sign } from 'jsonwebtoken';

import { graphqlAuth } from '../../../src/modules/auth/auth.guard';
import { AuditService } from '../../../src/modules/core/audit.service';
import { DIContainer } from '../../../src/modules/core/di.container';
import { prisma } from '../../../src/prisma';

jest.mock('../../../src/server', () => ({ JWT_SECRET: 'testsecret' }));

process.env.JWT_SECRET = 'testsecret';

jest.mock('../../../src/modules/core/di.container');
// Mock prisma client used in auth.guard
jest.mock('../../../src/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockAuditImpl = {
  logUserLogin: jest.fn(),
  logEvent: jest.fn(),
};
const mockAudit = mockAuditImpl as unknown as AuditService;

const containerInstance = {
  resolve: jest.fn().mockReturnValue(mockAudit),
};
(jest.mocked(DIContainer.getInstance as any) as any).mockReturnValue(containerInstance);

// Import after setting env and mocks

describe('graphqlAuth', () => {
  beforeEach(() => {
    containerInstance.resolve.mockReturnValue(mockAudit);
    jest.mocked(prisma.user.findUnique).mockClear();
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ tokenVersion: 1 } as any);
    mockAuditImpl.logUserLogin.mockClear();
    mockAuditImpl.logEvent.mockClear();
  });

  test('allows login and register operations without auth', async () => {
    const result = await graphqlAuth({ req: { body: { operationName: 'Login' } } as any });
    expect(result.userId).toBeNull();
  });

  test('allows register operation without auth', async () => {
    const result = await graphqlAuth({ req: { body: { operationName: 'Register' } } as any });
    expect(result.userId).toBeNull();
  });

  test('allows introspection queries without auth headers', async () => {
    const result = await graphqlAuth({
      req: { body: { query: 'query IntrospectionQuery { __schema { types { name } } }' } } as any,
    });
    expect(result.userId).toBeNull();
  });

  test('throws when auth header missing', async () => {
    await expect(graphqlAuth({ req: { body: {}, headers: {} } as any })).rejects.toThrow(
      'Authorization header missing',
    );
  });

  test('returns context for valid token', async () => {
    const token = sign({ sub: '1', userRole: 'USER', gymRoles: [], tokenVersion: 1 }, 'testsecret');
    const req = { body: {}, headers: { authorization: `Bearer ${token}` }, ip: '1.1.1.1' } as any;
    const ctx = await graphqlAuth({ req });
    expect(ctx.userId).toBe(1);
    expect(mockAuditImpl.logUserLogin).toHaveBeenCalled();
  });

  test('fills optional token claims with defaults when omitted', async () => {
    const token = sign({ sub: '2', userRole: 'USER', tokenVersion: 1 }, 'testsecret');
    const req = { body: {}, headers: { authorization: `Bearer ${token}` }, ip: '3.3.3.3' } as any;
    const ctx = await graphqlAuth({ req });

    expect(ctx.gymRoles).toEqual([]);
    expect(ctx.isPremium).toBe(false);
  });

  test('throws for invalid token', async () => {
    const req = { body: {}, headers: { authorization: 'Bearer bad' }, ip: '1.1.1.1' } as any;
    await expect(graphqlAuth({ req })).rejects.toThrow('Invalid or expired token');
  });

  test('throws when token version mismatch', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ tokenVersion: 2 } as any);
    const token = sign({ sub: '1', userRole: 'USER', gymRoles: [], tokenVersion: 1 }, 'testsecret');
    const req = { body: {}, headers: { authorization: `Bearer ${token}` }, ip: '1.1.1.1' } as any;
    await expect(graphqlAuth({ req })).rejects.toThrow();
  });

  test('logs and rejects when token subject is non-numeric', async () => {
    const token = sign(
      { sub: 'abc', userRole: 'USER', gymRoles: [], tokenVersion: 1 },
      'testsecret',
    );
    const req = { body: {}, headers: { authorization: `Bearer ${token}` }, ip: '2.2.2.2' } as any;

    await expect(graphqlAuth({ req })).rejects.toThrow('Invalid or expired token');

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockAuditImpl.logEvent).toHaveBeenCalledWith({
      action: 'LOGIN_FAILURE',
      metadata: { error: 'Invalid user ID in token.', ip: '2.2.2.2' },
    });
  });
});
