import { AuthContext, GymRole, UserRole } from '../../../src/modules/auth/auth.types';
import { MediaResolvers } from '../../../src/modules/media/media.resolvers';

const baseCtx = {
  prisma: {} as any,
  permissionService: {} as any,
  imageIntakeService: {} as any,
  imagePromotionService: {} as any,
  imageModerationService: {} as any,
  recognitionService: {} as any,
  appRole: undefined,
  userRole: UserRole.USER,
  isPremium: false,
} as Partial<AuthContext>;

describe('MediaResolvers.imageUrl', () => {
  it('allows private key for same gym', async () => {
    const mediaService = {
      imageUrl: jest
        .fn()
        .mockResolvedValue({ url: 'signed', expiresAt: '2025-01-01T00:00:00.000Z' }),
    };
    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 1,
      gymRoles: [{ gymId: 7, role: GymRole.GYM_ADMIN }],
      mediaService: mediaService as any,
    } as AuthContext;

    const out = await MediaResolvers.Query.imageUrl(
      null,
      { storageKey: 'private/uploads/7/2025/01/file.jpg', ttlSec: 60 },
      ctx,
    );
    expect(out.url).toBe('signed');
    expect(mediaService.imageUrl).toHaveBeenCalled();
  });

  it('rejects foreign gym access', async () => {
    const mediaService = { imageUrl: jest.fn() };
    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 1,
      gymRoles: [{ gymId: 8, role: GymRole.GYM_ADMIN }],
      mediaService: mediaService as any,
    } as AuthContext;

    await expect(
      MediaResolvers.Query.imageUrl(
        null,
        { storageKey: 'private/uploads/7/2025/01/file.jpg', ttlSec: 60 },
        ctx,
      ),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  });
});
