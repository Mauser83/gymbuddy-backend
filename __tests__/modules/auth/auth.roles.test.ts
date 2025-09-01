import {
  verifyRoles,
  verifyGymScope,
  verifyPremiumAccess,
} from "../../../src/modules/auth/auth.roles";
import {
  AuthContext,
  GymRole,
  AppRole,
  UserRole,
} from "../../../src/modules/auth/auth.types";

const permissionService = {
  checkPermission: jest.fn(),
};

describe("auth.roles", () => {
  const baseContext: AuthContext = {
    userId: 1,
    appRole: undefined,
    userRole: UserRole.USER,
    gymRoles: [],
    isPremium: false,
    prisma: {} as any,
    permissionService: permissionService as any,
    mediaService: {} as any,
    imageIntakeService: {} as any,
    imagePromotionService: {} as any,
    imageModerationService: {} as any,
    recognitionService: {} as any,
  };

  beforeEach(() => {
    permissionService.checkPermission.mockReset();
  });

  test("verifyRoles throws when requirements not met", () => {
    expect(() =>
      verifyRoles(baseContext, { requireAppRole: AppRole.ADMIN })
    ).toThrow();
  });

  test("verifyRoles allows OR conditions", () => {
    const ctx = { ...baseContext, appRole: AppRole.ADMIN } as AuthContext;
    expect(() =>
      verifyRoles(ctx, {
        or: [
          { requireAppRole: AppRole.ADMIN },
          { requireUserRole: UserRole.PREMIUM_USER },
        ],
      })
    ).not.toThrow();
  });

  test("verifyGymScope passes for admin", () => {
    const ctx = { ...baseContext, appRole: AppRole.ADMIN } as AuthContext;
    expect(() =>
      verifyGymScope(ctx, permissionService as any, 1)
    ).not.toThrow();
  });

  test("verifyGymScope uses permissionService", () => {
    permissionService.checkPermission.mockReturnValue(true);
    const ctx = {
      ...baseContext,
      gymRoles: [{ gymId: 1, role: GymRole.GYM_ADMIN }],
    } as AuthContext;
    expect(() =>
      verifyGymScope(ctx, permissionService as any, 1)
    ).not.toThrow();
    expect(permissionService.checkPermission).toHaveBeenCalled();
  });

  test("verifyGymScope throws when not allowed", () => {
    permissionService.checkPermission.mockReturnValue(false);
    expect(() =>
      verifyGymScope(baseContext, permissionService as any, 1)
    ).toThrow();
  });

  test("verifyPremiumAccess allows admin", () => {
    const ctx = { ...baseContext, appRole: AppRole.ADMIN } as AuthContext;
    expect(() => verifyPremiumAccess(ctx)).not.toThrow();
  });

  test("verifyPremiumAccess throws without premium", () => {
    expect(() => verifyPremiumAccess(baseContext)).toThrow();
  });
});
