import crypto from 'crypto';
import { sign } from 'jsonwebtoken';

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
  let service: AuthService;

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

  test('login throws when password comparison fails', async () => {
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
    mockedCompare.mockResolvedValue(false);

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

  test('requestPasswordReset stores reset token metadata', async () => {
    const now = new Date('2023-01-01T00:00:00Z');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementation(
      (size: number, callback?: (err: Error | null, buf: Buffer) => void) => {
        const buffer = Buffer.from('deadbeef', 'hex');
        if (callback) {
          callback(null, buffer);
          return buffer;
        }
        return buffer;
      },
    );
    prisma.user.findUnique.mockResolvedValue({ id: 42 });

    const result = await service.requestPasswordReset({ email: 'known@test.com' });

    expect(randomBytesSpy).toHaveBeenCalledWith(32);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: 'known@test.com' },
      data: {
        resetToken: 'deadbeef',
        resetTokenExpiresAt: new Date(now.getTime() + 3600000),
      },
    });
    expect(result).toEqual({ message: 'Reset email sent' });

    randomBytesSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test('resetPassword fails with invalid token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.resetPassword({ token: 'bad', password: 'newpass' })).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  test('resetPassword updates password and clears metadata', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 7 });
    mockedHash.mockResolvedValue('rehashed');

    const result = await service.resetPassword({ token: 'valid', password: 'newpass' });

    expect(mockedHash).toHaveBeenCalledWith('newpass');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        password: 'rehashed',
        resetToken: null,
        resetTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
    expect(result).toEqual({ message: 'Password reset successfully' });
  });

  test('refreshToken validates token and token version', async () => {
    const refresh = sign({ sub: '1', tokenVersion: 1 }, 'testsecret');
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
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(service.refreshToken({ refreshToken: 'bad.token' })).rejects.toThrow(
      'Invalid or expired refresh token',
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('refreshToken fails for mismatched token version', async () => {
    const refresh = sign({ sub: '1', tokenVersion: 2 }, 'testsecret');
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

  test('refreshToken fails when user lookup returns nothing', async () => {
    const refresh = sign({ sub: '1', tokenVersion: 1 }, 'testsecret');
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.refreshToken({ refreshToken: refresh })).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });

  test('refreshToken fails when payload user id is invalid', async () => {
    const refresh = sign({ sub: 'NaN', tokenVersion: 1 }, 'testsecret');

    await expect(service.refreshToken({ refreshToken: refresh })).rejects.toThrow(
      'Invalid or expired refresh token',
    );
  });

  test('getUserGymRoles returns mapped memberships', async () => {
    prisma.gymManagementRole.findMany.mockResolvedValue([
      { gymId: 5, role: 'OWNER' },
      { gymId: 8, role: 'MANAGER' },
    ]);

    const roles = await (service as any).getUserGymRoles(99);

    expect(prisma.gymManagementRole.findMany).toHaveBeenCalledWith({
      where: { userId: 99 },
      select: { gymId: true, role: true },
    });
    expect(roles).toEqual([
      { gymId: 5, role: 'OWNER' },
      { gymId: 8, role: 'MANAGER' },
    ]);
  });
});
