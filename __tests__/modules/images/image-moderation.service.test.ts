import { ImageModerationService } from "../../../src/modules/images/image-moderation.service";
import { PrismaClient } from "../../../src/lib/prisma";
import { ImagePromotionService } from "../../../src/modules/images/image-promotion.service";
import { AuthContext, UserRole } from "../../../src/modules/auth/auth.types";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { cleanDB, prisma } from "../../testUtils";

jest.spyOn(S3Client.prototype, "send").mockImplementation((cmd: any) => {
  if (cmd instanceof DeleteObjectCommand) {
    return Promise.resolve({} as any);
  }
  return Promise.resolve({} as any);
});

describe("ImageModerationService", () => {
  const baseCtx: AuthContext = {
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

  function createPrismaMock() {
    return {
      gymEquipmentImage: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as PrismaClient;
  }

  it("approves and promotes image", async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 1,
      status: "PENDING",
      isSafe: true,
    });
    const promo = {
      promoteGymImageToGlobal: jest
        .fn()
        .mockResolvedValue({ equipmentImage: { id: "e1" }, gymImage: { id: "g1", status: "APPROVED" } }),
    } as unknown as ImagePromotionService;
    const svc = new ImageModerationService(prismaMock, promo);
    const res = await svc.approveGymImage({ id: "g1" }, baseCtx);
    expect(res.equipmentImage.id).toBe("e1");
    expect(promo.promoteGymImageToGlobal).toHaveBeenCalled();
    expect(prismaMock.gymEquipmentImage.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { status: "APPROVED" },
    });
  });

  it("blocks unsafe approval unless forced", async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 1,
      status: "PENDING",
      isSafe: false,
    });
    const promo = { promoteGymImageToGlobal: jest.fn() } as any;
    const svc = new ImageModerationService(prismaMock, promo);
    await expect(svc.approveGymImage({ id: "g1" }, baseCtx)).rejects.toThrow();
    await expect(
      svc.approveGymImage({ id: "g1", force: true }, baseCtx)
    ).resolves.toBeDefined();
  });

  it("reject deletes object when requested", async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: "g1",
      gymId: 1,
      storageKey: "key",
    });
    (prismaMock.gymEquipmentImage.update as any).mockResolvedValue({
      id: "g1",
      gymId: 1,
      storageKey: "key",
      status: "REJECTED",
    });
    const svc = new ImageModerationService(prismaMock, {} as any);
    await svc.rejectGymImage({ id: "g1", deleteObject: true }, baseCtx);
    expect(S3Client.prototype.send).toHaveBeenCalledWith(
      expect.any(DeleteObjectCommand)
    );
  });

  describe("candidateGlobalImages", () => {
    let svc: ImageModerationService;
    let equipId: number;
    beforeAll(() => {
      svc = new ImageModerationService(prisma, {} as any);
    });
    beforeEach(async () => {
      await cleanDB();
      const user = await prisma.user.create({
        data: { username: "u", email: "e@e.com", password: "pw" },
      });
      const gym = await prisma.gym.create({
        data: {
          name: "Gym",
          country: "US",
          city: "City",
          address: "Addr",
          creatorId: user.id,
        },
      });
      const cat = await prisma.equipmentCategory.create({
        data: { name: "Cat", slug: "cat" },
      });
      const equip = await prisma.equipment.create({
        data: { name: "Eq", brand: "B", categoryId: cat.id },
      });
      equipId = equip.id;
      await prisma.equipmentImage.create({
        data: {
          equipmentId: equipId,
          storageKey: "public/golden/eq.jpg",
          mimeType: "image/jpeg",
          width: 0,
          height: 0,
          sha256: "dup",
        },
      });
      await prisma.gymEquipmentImage.createMany({
        data: [
          { id: "img1", gymId: gym.id, equipmentId: equipId, status: "PENDING", storageKey: "a", sha256: "dup" },
          { id: "img2", gymId: gym.id, equipmentId: equipId, status: "PENDING", storageKey: "b", sha256: null },
          { id: "img3", gymId: gym.id, equipmentId: equipId, status: "APPROVED", storageKey: "c", sha256: "uniq" },
          { id: "img4", gymId: gym.id, equipmentId: equipId, status: "REJECTED", storageKey: "d", sha256: "x" },
        ],
      });
    });

    it("excludes promoted and includes null sha", async () => {
      const res = await svc.candidateGlobalImages({ equipmentId: equipId });
      const ids = res.map((r: any) => r.id).sort();
      expect(ids).toEqual(["img2", "img3"]);
      res.forEach((r: any) => {
        expect(r).toHaveProperty("createdAt");
        expect(r.gymName).toBe("Gym");
        expect(r.dupCount).toBe(0);
        expect(r.safety.state).toBe("PENDING");
      });
    });
  });
});
