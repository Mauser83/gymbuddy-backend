import { AuthService } from './auth.service';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
} from './auth.types';
import type { AuthContext } from '../auth/auth.types';

export const AuthResolvers = {
  Mutation: {
    register: async (_: unknown, args: { input: RegisterInput }, context: AuthContext) => {
      const authService = new AuthService(context.prisma);
      return authService.register(args.input);
    },

    login: async (_: unknown, args: { input: LoginInput }, context: AuthContext) => {
      const authService = new AuthService(context.prisma);
      return authService.login(args.input);
    },

    refreshToken: async (_: unknown, args: { input: RefreshTokenInput }, context: AuthContext) => {
      const authService = new AuthService(context.prisma);
      return authService.refreshToken(args.input);
    },

    requestPasswordReset: async (
      _: unknown,
      args: { input: RequestPasswordResetInput },
      context: AuthContext,
    ) => {
      const authService = new AuthService(context.prisma);
      return authService.requestPasswordReset(args.input);
    },

    resetPassword: async (
      _: unknown,
      args: { input: ResetPasswordInput },
      context: AuthContext,
    ) => {
      const authService = new AuthService(context.prisma);
      return authService.resetPassword(args.input);
    },
  },
};
