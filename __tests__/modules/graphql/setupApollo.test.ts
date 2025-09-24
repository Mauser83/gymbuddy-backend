import resolvers from '../../../src/graphql/rootResolvers';
import typeDefs from '../../../src/graphql/rootSchema';
import { setupApollo } from '../../../src/graphql/setupApollo';
import { AppRole, GymRole, UserRole } from '../../../src/modules/auth/auth.types';
import type { PermissionService } from '../../../src/modules/core/permission.service';
import type { ImageIntakeService } from '../../../src/modules/images/image-intake.service';
import type { ImageModerationService } from '../../../src/modules/images/image-moderation.service';
import type { ImagePromotionService } from '../../../src/modules/images/image-promotion.service';
import type { MediaService } from '../../../src/modules/media/media.service';
import type { RecognitionService } from '../../../src/modules/recognition/recognition.service';
import type { PrismaClient } from '../../../src/prisma';

const startMock = jest.fn();

jest.mock('@apollo/server', () => ({
  ApolloServer: jest.fn(() => ({
    start: startMock,
  })),
}));

jest.mock('@apollo/server/express4', () => ({
  expressMiddleware: jest.fn(),
}));

jest.mock('../../../src/modules/auth/auth.guard', () => ({
  graphqlAuth: jest.fn(),
}));

const expressMiddlewareMock = (
  jest.requireMock('@apollo/server/express4') as {
    expressMiddleware: jest.Mock;
  }
).expressMiddleware;

const graphqlAuthMock = (
  jest.requireMock('../../../src/modules/auth/auth.guard') as {
    graphqlAuth: jest.Mock;
  }
).graphqlAuth;

describe('setupApollo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes Apollo server and composes auth context', async () => {
    const appUse = jest.fn();
    const app = { use: appUse };

    const prisma = { name: 'prisma' } as unknown as PrismaClient;
    const permissionService = { name: 'permissions' } as unknown as PermissionService;
    const mediaService = { name: 'media' } as unknown as MediaService;
    const imageIntakeService = { name: 'intake' } as unknown as ImageIntakeService;
    const imagePromotionService = { name: 'promotion' } as unknown as ImagePromotionService;
    const imageModerationService = { name: 'moderation' } as unknown as ImageModerationService;
    const recognitionService = { name: 'recognition' } as unknown as RecognitionService;

    const contextHandlers: Array<(args: any) => Promise<any>> = [];
    expressMiddlewareMock.mockImplementation((_server, options) => {
      contextHandlers.push(options.context);
      return 'middleware';
    });

    graphqlAuthMock
      .mockResolvedValueOnce({
        userId: 101,
        appRole: AppRole.ADMIN,
        userRole: UserRole.PERSONAL_TRAINER,
        gymRoles: [{ gymId: 7, role: GymRole.GYM_ADMIN }],
        isPremium: true,
      })
      .mockResolvedValueOnce({
        userId: undefined,
        appRole: undefined,
        userRole: UserRole.USER,
        gymRoles: undefined,
        isPremium: undefined,
      });

    await setupApollo(
      app as any,
      prisma,
      permissionService,
      mediaService,
      imageIntakeService,
      imagePromotionService,
      imageModerationService,
      recognitionService,
    );

    const { ApolloServer } = jest.requireMock('@apollo/server') as { ApolloServer: jest.Mock };

    expect(ApolloServer).toHaveBeenCalledWith({ typeDefs, resolvers });
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(expressMiddlewareMock).toHaveBeenCalledTimes(1);

    expect(appUse).toHaveBeenCalledWith('/graphql', 'middleware');

    const contextFn = contextHandlers[0];
    expect(typeof contextFn).toBe('function');

    const firstReq = { headers: { authorization: 'Bearer token' } };
    const firstContext = await contextFn({ req: firstReq });

    expect(graphqlAuthMock).toHaveBeenNthCalledWith(1, { req: firstReq });
    expect(firstContext).toEqual({
      userId: 101,
      appRole: AppRole.ADMIN,
      userRole: UserRole.PERSONAL_TRAINER,
      gymRoles: [{ gymId: 7, role: GymRole.GYM_ADMIN }],
      isPremium: true,
      prisma,
      permissionService,
      mediaService,
      imageIntakeService,
      imagePromotionService,
      imageModerationService,
      recognitionService,
    });

    const secondReq = { headers: {} };
    const secondContext = await contextFn({ req: secondReq });

    expect(graphqlAuthMock).toHaveBeenNthCalledWith(2, { req: secondReq });
    expect(secondContext).toEqual({
      userId: null,
      appRole: undefined,
      userRole: UserRole.USER,
      gymRoles: [],
      isPremium: false,
      prisma,
      permissionService,
      mediaService,
      imageIntakeService,
      imagePromotionService,
      imageModerationService,
      recognitionService,
    });
  });
});
