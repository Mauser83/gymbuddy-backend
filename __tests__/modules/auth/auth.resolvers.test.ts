import { AuthResolvers } from '../../../src/modules/auth/auth.resolvers';
import { AuthService } from '../../../src/modules/auth/auth.service';

jest.mock('../../../src/modules/auth/auth.service');

const mockedAuthService = jest.mocked(AuthService);

function createContext() {
  return {
    prisma: {},
    permissionService: {},
    userId: 1,
    userRole: 'USER',
    gymRoles: [],
    isPremium: false,
  } as any;
}

describe('AuthResolvers', () => {
  beforeEach(() => {
    mockedAuthService.mockClear();
  });

  test('register calls AuthService.register', async () => {
    const serviceInstance = { register: jest.fn() } as any;
    mockedAuthService.mockImplementation(() => serviceInstance);
    const context = createContext();
    await AuthResolvers.Mutation.register(
      null as any,
      { input: { username: 'u', email: 'a', password: 'p' } },
      context,
    );
    expect(serviceInstance.register).toHaveBeenCalled();
  });

  test('login calls AuthService.login', async () => {
    const serviceInstance = { login: jest.fn() } as any;
    mockedAuthService.mockImplementation(() => serviceInstance);
    const context = createContext();
    await AuthResolvers.Mutation.login(
      null as any,
      { input: { email: 'a', password: 'p' } },
      context,
    );
    expect(serviceInstance.login).toHaveBeenCalled();
  });

  test('refreshToken calls AuthService.refreshToken', async () => {
    const serviceInstance = { refreshToken: jest.fn() } as any;
    mockedAuthService.mockImplementation(() => serviceInstance);
    const context = createContext();
    await AuthResolvers.Mutation.refreshToken(
      null as any,
      { input: { refreshToken: 'r' } },
      context,
    );
    expect(serviceInstance.refreshToken).toHaveBeenCalled();
  });

  test('requestPasswordReset calls AuthService.requestPasswordReset', async () => {
    const serviceInstance = { requestPasswordReset: jest.fn() } as any;
    mockedAuthService.mockImplementation(() => serviceInstance);
    const context = createContext();
    await AuthResolvers.Mutation.requestPasswordReset(
      null as any,
      { input: { email: 'a' } },
      context,
    );
    expect(serviceInstance.requestPasswordReset).toHaveBeenCalled();
  });

  test('resetPassword calls AuthService.resetPassword', async () => {
    const serviceInstance = { resetPassword: jest.fn() } as any;
    mockedAuthService.mockImplementation(() => serviceInstance);
    const context = createContext();
    await AuthResolvers.Mutation.resetPassword(
      null as any,
      { input: { token: 't', password: 'p' } },
      context,
    );
    expect(serviceInstance.resetPassword).toHaveBeenCalled();
  });
});
