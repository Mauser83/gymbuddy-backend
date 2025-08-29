import { ImagePromotionService } from "../../../src/modules/images/image-promotion.service";
import { PrismaClient } from "../../../src/lib/prisma";
import {
  S3Client,
  HeadObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { AuthContext, UserRole } from "../../../src/modules/auth/auth.types";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gL+6rYPGQAAAABJRU5ErkJggg==",
  "base64"
);

jest.spyOn(S3Client.prototype, "send").mockImplementation((cmd: any) => {
  if (cmd instanceof HeadObjectCommand) {
    return Promise.resolve({ ContentType: "image/png" } as any);
  }
  if (cmd instanceof CopyObjectCommand) {
    return Promise.resolve({} as any);
  }
  if (cmd instanceof GetObjectCommand) {
    return Promise.resolve({
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array(ONE_BY_ONE_PNG)),
      },
    } as any);
  }
  return Promise.resolve({} as any);
});

function createPrismaMock() {
  const prisma = {
    gymEquipmentImage: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    equipmentImage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    imageEmbedding: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    imageQueue: {
      create: jest.fn(),
    },
    splitType: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: async (fn: any) => fn(prisma),
  } as unknown as PrismaClient;
  return prisma;
}

describe("promoteGymImageToGlobal", () => {
  const ctx: AuthContext = {
    userId: 1,
    appRole: "ADMIN",
    userRole: UserRole.USER,
    gymRoles: [],
    isPremium: false,
    prisma: {} as any,
    permissionService: {} as any,
    mediaService: {} as any,
    imageIntakeService: {} as any,
    imagePromotionService: {} as any,
    imageModerationService: {} as any,
  };

  it("copies object and creates equipment image", async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 10,
      equipmentId: 20,
      storageKey: "private/uploads/10/2025/01/img.jpg",
      sha256: "abc",
      status: "APPROVED",
      isSafe: true,
    });
    (prisma.equipmentImage.create as any).mockImplementation(({ data }: any) => ({
      id: "e1",
      storageKey: data.storageKey,
    }));
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: "g1" } as any, ctx);
    expect(res.equipmentImage.id).toBe("e1");
    expect(prisma.equipmentImage.create).toHaveBeenCalled();
    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ storageKey: res.destinationKey }),
    });
  });

  it("returns existing on duplicate sha", async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 10,
      equipmentId: 20,
      storageKey: "private/uploads/10/2025/01/img.jpg",
      sha256: "abc",
      status: "APPROVED",
      isSafe: true,
    });
    (prisma.equipmentImage.findFirst as any).mockResolvedValue({ id: "e1", storageKey: "public/golden/20/..." });
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: "g1" } as any, ctx);
    expect(res.equipmentImage.id).toBe("e1");
    expect(prisma.equipmentImage.create).not.toHaveBeenCalled();
  });

  it("uses training split when splitId matches", async () => {
    const prisma = createPrismaMock();
    (prisma.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 10,
      equipmentId: 20,
      storageKey: "private/uploads/10/2025/01/img.jpg",
      sha256: null,
      status: "APPROVED",
      isSafe: true,
    });
    (prisma.splitType.findUnique as any).mockResolvedValue({ key: "training" });
    (prisma.equipmentImage.create as any).mockImplementation(({ data }: any) => ({ id: "e1", storageKey: data.storageKey }));
    const svc = new ImagePromotionService(prisma);
    const res = await svc.promoteGymImageToGlobal({ id: "g1", splitId: 2 } as any, ctx);
    expect(res.destinationKey.startsWith("public/training/20/")).toBe(true);
  });
});