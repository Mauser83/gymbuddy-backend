import { sign } from 'jsonwebtoken';
import { prisma } from '../../../src/lib/prisma';
import { DIContainer } from '../../../src/modules/core/di.container';

jest.mock('../../../src/server', () => ({ JWT_SECRET: 'testsecret' }));

process.env.JWT_SECRET = 'testsecret';

jest.mock('../../../src/modules/core/di.container');
// Mock prisma client used in auth.guard
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockAudit = { logUserLogin: jest.fn(), logEvent: jest.fn() } as unknown as AuditService;

const containerInstance = {
  resolve: jest.fn().mockReturnValue(mockAudit),
};
(jest.mocked(DIContainer.getInstance as any) as any).mockReturnValue(containerInstance);

// Import after setting env and mocks
import { graphqlAuth } from '../../../src/modules/auth/auth.guard';
import { AuditService } from '../../../src/modules/core/audit.service';

describe('graphqlAuth', () => {
  beforeEach(() => {
    containerInstance.resolve.mockReturnValue(mockAudit);
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ tokenVersion: 1 } as any);
  });

  test('allows login and register operations without auth', async () => {
    const result = await graphqlAuth({ req: { body: { operationName: 'Login' } } as any });
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
    expect(mockAudit.logUserLogin).toHaveBeenCalled();
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
});
