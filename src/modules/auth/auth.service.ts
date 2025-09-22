import crypto from 'crypto';
import { sign, verify } from 'jsonwebtoken';

import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './auth.dto';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
} from './auth.types';
import { validateInput } from '../../middlewares/validation';
import { AppRole, GymRole, PrismaClient, UserRole } from '../../prisma';
import { JWT_SECRET } from '../../server';
import { hashPassword, comparePassword } from '../auth/auth.helpers';

const ACCESS_TOKEN_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRATION = '7d';

export interface AccessTokenPayload {
  userId: number;
  username: string;
  appRole: AppRole | null;
  userRole: UserRole;
  gymRoles: {
    gymId: number;
    role: GymRole;
  }[];
  tokenVersion: number;
}

export class AuthService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async getUserGymRoles(userId: number): Promise<Array<{ gymId: number; role: GymRole }>> {
    const memberships = await this.prisma.gymManagementRole.findMany({
      where: { userId: userId },
      select: { gymId: true, role: true },
    });
    return memberships.map((m) => ({
      gymId: m.gymId,
      role: m.role as GymRole,
    }));
  }

  private generateAccessToken(user: AccessTokenPayload) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not defined');

    return sign(
      {
        sub: user.userId.toString(),
        username: user.username,
        appRole: user.appRole,
        userRole: user.userRole,
        gymRoles: user.gymRoles,
        tokenVersion: user.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRATION },
    );
  }

  private generateRefreshToken(userId: number, tokenVersion: number) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not defined');

    return sign({ sub: userId, tokenVersion }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
    });
  }

  async register(input: RegisterInput) {
    await validateInput(input, RegisterDto);

    const hashedPassword = await hashPassword(input.password);

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password: hashedPassword,
        userRole: 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        appRole: true,
        userRole: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
        gymManagementRoles: {
          select: {
            role: true,
            gym: {
              select: {
                id: true,
                name: true,
                isApproved: true,
              },
            },
          },
        },
      },
    });

    const payload: AccessTokenPayload = {
      userId: user.id,
      username: user.username,
      appRole: user.appRole,
      userRole: user.userRole,
      gymRoles: user.gymManagementRoles.map((role) => ({
        gymId: role.gym.id,
        role: role.role,
      })),
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(user.id, user.tokenVersion),
      user,
    };
  }

  async login(input: LoginInput) {
    await validateInput(input, LoginDto);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        username: true,
        password: true,
        appRole: true,
        userRole: true,
        tokenVersion: true,
        createdAt: true,
        gymManagementRoles: {
          select: {
            role: true,
            gym: {
              select: {
                id: true,
                name: true,
                isApproved: true,
              },
            },
          },
        },
      },
    });

    if (!user || !(await comparePassword(input.password, user.password))) {
      throw new Error('Invalid credentials');
    }

    const payload: AccessTokenPayload = {
      userId: user.id,
      username: user.username,
      appRole: user.appRole,
      userRole: user.userRole,
      gymRoles: user.gymManagementRoles.map((role) => ({
        gymId: role.gym.id,
        role: role.role,
      })),
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(user.id, user.tokenVersion),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        appRole: user.appRole,
        userRole: user.userRole,
        createdAt: user.createdAt,
        gymManagementRoles: user.gymManagementRoles,
      },
    };
  }

  async requestPasswordReset(input: RequestPasswordResetInput) {
    await validateInput(input, RequestPasswordResetDto);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) throw new Error('Invalid email');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 3600000);

    await this.prisma.user.update({
      where: { email: input.email },
      data: {
        resetToken,
        resetTokenExpiresAt,
      },
    });

    // TODO: Send resetToken via email
    return { message: 'Reset email sent' };
  }

  async resetPassword(input: ResetPasswordInput) {
    await validateInput(input, ResetPasswordDto);

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: input.token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) throw new Error('Invalid or expired token');

    const hashedPassword = await hashPassword(input.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Password reset successfully' };
  }

  async refreshToken(input: RefreshTokenInput) {
    await validateInput(input, RefreshTokenDto);

    try {
      if (!JWT_SECRET) throw new Error('JWT_SECRET not defined');

      const payload = verify(input.refreshToken, JWT_SECRET) as unknown as {
        sub: string;
        tokenVersion: number;
      };

      const userId = parseInt(payload.sub, 10);
      if (isNaN(userId)) {
        throw new Error('Invalid user ID in refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          appRole: true,
          userRole: true,
          tokenVersion: true,
          gymManagementRoles: {
            select: {
              role: true,
              gym: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!user) throw new Error('User not found');
      if (user.tokenVersion !== payload.tokenVersion) throw new Error('Token version mismatch');

      return {
        accessToken: this.generateAccessToken({
          userId: user.id,
          username: user.username,
          appRole: user.appRole,
          userRole: user.userRole,
          gymRoles: user.gymManagementRoles.map((role) => ({
            gymId: role.gym.id,
            role: role.role,
          })),
          tokenVersion: user.tokenVersion,
        }),
        refreshToken: this.generateRefreshToken(user.id, user.tokenVersion),
      };
    } catch (err) {
      console.error(err);
      throw new Error('Invalid or expired refresh token');
    }
  }
}
