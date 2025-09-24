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

describe('MediaResolvers.Mutation.getImageUploadUrl', () => {
  it('returns presigned upload payload after validation', async () => {
    const mediaService = {
      getImageUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://upload.example',
        storageKey: 'private/uploads/7/foo.png',
      }),
    };

    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 42,
      gymRoles: [],
      mediaService: mediaService as any,
    } as AuthContext;

    const input = {
      gymId: 7,
      contentType: 'image/png',
      filename: 'foo.png',
      sha256: 'abc123',
      contentLength: 1024,
      ttlSec: 600,
    };

    const result = await MediaResolvers.Mutation.getImageUploadUrl(
      null,
      { input },
      ctx,
    );

    expect(result).toEqual({
      uploadUrl: 'https://upload.example',
      storageKey: 'private/uploads/7/foo.png',
    });
    expect(mediaService.getImageUploadUrl).toHaveBeenCalledWith({
      gymId: 7,
      contentType: 'image/png',
      filename: 'foo.png',
      sha256: 'abc123',
      contentLength: 1024,
      ttlSec: 600,
    });
  });
});

describe('MediaResolvers.Mutation.createUploadSession', () => {
  it('delegates to media service once validated', async () => {
    const mediaService = {
      createUploadSession: jest.fn().mockResolvedValue({ sessionId: 'sess', uploads: [] }),
    };

    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 77,
      gymRoles: [],
      mediaService: mediaService as any,
    } as AuthContext;

    const dto = {
      gymId: 11,
      count: 2,
      contentTypes: ['image/jpeg', 'image/png'],
      filenamePrefix: 'set-',
      equipmentId: 99,
    };

    const result = await MediaResolvers.Mutation.createUploadSession(
      null,
      { input: dto },
      ctx,
    );

    expect(result).toEqual({ sessionId: 'sess', uploads: [] });
    expect(mediaService.createUploadSession).toHaveBeenCalledWith({
      gymId: 11,
      count: 2,
      contentTypes: ['image/jpeg', 'image/png'],
      filenamePrefix: 'set-',
      equipmentId: 99,
    });
  });
});

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

  it('returns signed url for public keys without gym checks', async () => {
    const mediaService = {
      imageUrl: jest.fn().mockResolvedValue({ url: 'https://public', expiresAt: 'future-date' }),
    };

    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 5,
      gymRoles: [],
      mediaService: mediaService as any,
    } as AuthContext;

    const result = await MediaResolvers.Query.imageUrl(
      null,
      { storageKey: 'public/golden/awesome.png', ttlSec: 120 },
      ctx,
    );

    expect(result).toEqual({
      storageKey: 'public/golden/awesome.png',
      url: 'https://public',
      expiresAt: 'future-date',
    });
    expect(mediaService.imageUrl).toHaveBeenCalledWith(
      'public/golden/awesome.png',
      120,
      5,
    );
  });
});

describe('MediaResolvers.imageUrlMany', () => {
  it('validates input and returns batch urls', async () => {
    const mediaService = {
      imageUrlMany: jest.fn().mockResolvedValue([
        { storageKey: 'public/golden/one.png', url: 'https://1', expiresAt: '2025-01-01' },
        { storageKey: 'public/golden/two.png', url: 'https://2', expiresAt: '2025-01-02' },
      ]),
    };

    const ctx: AuthContext = {
      ...(baseCtx as any),
      userId: 9,
      gymRoles: [],
      mediaService: mediaService as any,
    } as AuthContext;

    const result = await MediaResolvers.Query.imageUrlMany(
      null,
      { storageKeys: ['public/golden/one.png', 'public/golden/two.png'], ttlSec: 45 },
      ctx,
    );

    expect(result).toEqual([
      { storageKey: 'public/golden/one.png', url: 'https://1', expiresAt: '2025-01-01' },
      { storageKey: 'public/golden/two.png', url: 'https://2', expiresAt: '2025-01-02' },
    ]);
    expect(mediaService.imageUrlMany).toHaveBeenCalledWith(
      ['public/golden/one.png', 'public/golden/two.png'],
      45,
    );
  });
});