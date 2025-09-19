import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'testsecret';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.helpers');
import { validateInput } from '../../../src/middlewares/validation';
import { comparePassword, hashPassword } from '../../../src/modules/auth/auth.helpers';
import { AuthService } from '../../../src/modules/auth/auth.service';

const mockedValidate = jest.mocked(validateInput as any);
const mockedHash = jest.mocked(hashPassword);
const mockedCompare = jest.mocked(comparePassword);

describe('AuthService', () => {
  let prisma: any;
  let service: typeof AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'testsecret';
  });

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      gymManagementRole: {
        findMany: jest.fn(),
      },
    };
    service = new AuthService(prisma);
    mockedValidate.mockResolvedValue(undefined as any);
    mockedHash.mockResolvedValue('hashed');
    mockedCompare.mockResolvedValue(true);
    prisma.gymManagementRole.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  test('register creates user and returns tokens', async () => {
    prisma.user.create.mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      username: 'user',
      appRole: null,
      userRole: 'USER',
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      gymManagementRoles: [],
    });

    const result = await service.register({
      username: 'user',
      email: 'a@example.com',
      password: 'pass',
    });

    expect(prisma.user.create).toHaveBeenCalled();
    expect(result.user.username).toBe('user');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  test('login throws for invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'a@example.com', password: 'pass' })).rejects.toThrow(
      'Invalid credentials',
    );
  });

  test('login returns tokens when credentials valid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      username: 'user',
      password: 'hashed',
      appRole: null,
      userRole: 'USER',
      tokenVersion: 1,
      createdAt: new Date(),
      gymManagementRoles: [],
    });
    mockedCompare.mockResolvedValue(true);
    const result = await service.login({ email: 'a@example.com', password: 'pass' });
    expect(result.user.email).toBe('a@example.com');
    expect(result.accessToken).toBeDefined();
  });

  test('requestPasswordReset fails for unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.requestPasswordReset({ email: 'x@test.com' })).rejects.toThrow(
      'Invalid email',
    );
  });

  test('resetPassword fails with invalid token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword({ token: 'bad', password: 'newpass' })).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  test('refreshToken validates token and token version', async () => {
    const refresh = jwt.sign({ sub: '1', tokenVersion: 1 }, 'testsecret');
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'u',
      email: 'a',
      appRole: null,
      userRole: 'USER',
      tokenVersion: 1,
      gymManagementRoles: [],
    });
    const result = await service.refreshToken({ refreshToken: refresh });
    expect(result.accessToken).toBeDefined();
  });

  test('refreshToken fails for invalid token', async () => {
    await expect(service.refreshToken({ refreshToken: 'bad.token' })).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });

  test('refreshToken fails for mismatched token version', async () => {
    const refresh = jwt.sign({ sub: '1', tokenVersion: 2 }, 'testsecret');
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'u',
      email: 'a',
      appRole: null,
      userRole: 'USER',
      tokenVersion: 1,
      gymManagementRoles: [],
    });
    await expect(service.refreshToken({ refreshToken: refresh })).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });
});
