import { GymService } from "../../../src/modules/gym/gym.service";
import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "../../../src/lib/prisma";
import { PermissionService } from "../../../src/modules/core/permission.service";
import { validateInput } from "../../../src/middlewares/validation";
import { pubsub } from "../../../src/graphql/rootResolvers";

jest.mock("../../../src/middlewares/validation");
jest.mock("../../../src/graphql/rootResolvers", () => ({
  pubsub: { publish: jest.fn() },
}));

const mockedValidate = jest.mocked(validateInput as any);
const mockedPublish = jest.mocked(pubsub.publish);

describe("GymService", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let permissionService: {
    getUserRoles: jest.Mock;
    checkPermission: jest.Mock;
    verifyAppRoles: jest.Mock;
  };
  let service: GymService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permissionService = {
      getUserRoles: jest.fn(),
      checkPermission: jest.fn(),
      verifyAppRoles: jest.fn(),
    } as any;
    service = new GymService(prisma, permissionService as any);
    mockedValidate.mockResolvedValue(undefined as any);
    mockedPublish.mockClear();
  });

  afterEach(() => jest.clearAllMocks());

  test("createGym creates gym and role when missing", async () => {
    prisma.gym.create.mockResolvedValue({ id: 1 } as any);
    prisma.gymManagementRole.findFirst.mockResolvedValue(null as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);

    const input: any = { name: "g1", country: "c", city: "ct", address: "a" };
    const res = await service.createGym(5, input);

    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gym.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...input,
        isApproved: false,
        creatorId: 5,
      }),
    });
    expect(prisma.gymManagementRole.create).toHaveBeenCalledWith({
      data: { gymId: 1, userId: 5, role: "GYM_ADMIN" },
    });
    expect(mockedPublish).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test("createGym does not create role twice", async () => {
    prisma.gym.create.mockResolvedValue({ id: 1 } as any);
    prisma.gymManagementRole.findFirst.mockResolvedValue({ id: 99 } as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);

    await service.createGym(5, {
      name: "g",
      country: "c",
      city: "ct",
      address: "a",
    } as any);

    expect(prisma.gymManagementRole.create).not.toHaveBeenCalled();
  });

  test("getGyms requires auth", async () => {
    await expect(service.getGyms(undefined as any)).rejects.toThrow(
      "Unauthorized"
    );
  });

  test("getGyms passes search filters", async () => {
    prisma.gym.findMany.mockResolvedValue([] as any);
    await service.getGyms(1, "abc");
    expect(prisma.gym.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  test("getGymById throws when not found", async () => {
    prisma.gym.findUnique.mockResolvedValue(null as any);
    await expect(service.getGymById(1, 1)).rejects.toThrow("Gym not found");
  });

  test("getGymById checks approval and roles", async () => {
    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [],
    } as any);
    await expect(service.getGymById(1, 2)).rejects.toThrow("Unauthorized");

    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [{ role: "GYM_ADMIN" }],
    } as any);
    const g = await service.getGymById(1, 2);
    expect(g).toEqual({
      id: 1,
      isApproved: false,
      gymRoles: [{ role: "GYM_ADMIN" }],
    });

    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [],
    } as any);
    const g2 = await service.getGymById(1, 2, "ADMIN");
    expect(g2).toEqual({ id: 1, isApproved: false, gymRoles: [] });
  });

  test("getPendingGyms checks roles", async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ["ADMIN"] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.gym.findMany.mockResolvedValue([] as any);
    await service.getPendingGyms(1);
    expect(prisma.gym.findMany).toHaveBeenCalledWith({
      where: { isApproved: false },
      orderBy: { createdAt: "desc" },
      include: { creator: true },
    });
  });

  test("getPendingGyms forbidden when roles fail", async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.getPendingGyms(1)).rejects.toThrow("Forbidden");
  });

  test("approveGym updates and publishes", async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ["ADMIN"] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.gym.update.mockResolvedValue({ id: 1 } as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);
    const res = await service.approveGym(1, 1);
    expect(prisma.gym.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isApproved: true },
    });
    expect(mockedPublish).toHaveBeenCalled();
    expect(res).toBe("Gym approved successfully");
  });

  test("approveGym forbidden when roles fail", async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.approveGym(1, 1)).rejects.toThrow("Forbidden");
  });

  test("updateGym requires permission when not admin", async () => {
    const spy = jest
      .spyOn(service as any, "checkGymPermission")
      .mockResolvedValue(true);
    prisma.gym.update.mockResolvedValue({ id: 1 } as any);
    await service.updateGym(1, 2, { name: "n" } as any, "USER");
    expect(spy).toHaveBeenCalled();
    expect(prisma.gym.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { name: "n" },
    });
  });

  test("updateGym throws when permission denied", async () => {
    jest.spyOn(service as any, "checkGymPermission").mockResolvedValue(false);
    await expect(service.updateGym(1, 2, {} as any, "USER")).rejects.toThrow(
      "Insufficient gym permissions"
    );
  });

  test("deleteGym requires permission when not admin", async () => {
    const spy = jest
      .spyOn(service as any, "checkGymPermission")
      .mockResolvedValue(true);
    prisma.gym.delete.mockResolvedValue({} as any);
    const res = await service.deleteGym(1, 2, "USER");
    expect(spy).toHaveBeenCalled();
    expect(prisma.gym.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(res).toBe("Gym deleted successfully");
  });

  test("deleteGym throws when permission denied", async () => {
    jest.spyOn(service as any, "checkGymPermission").mockResolvedValue(false);
    await expect(service.deleteGym(1, 2, "USER")).rejects.toThrow(
      "Unauthorized"
    );
  });

  test("addTrainer checks roles and user type", async () => {
    jest.spyOn(service as any, "checkGymPermission").mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      userRole: "PERSONAL_TRAINER",
    } as any);
    prisma.gymTrainer.create.mockResolvedValue({} as any);
    const res = await service.addTrainer(1, 2, 3);
    expect(prisma.gymTrainer.create).toHaveBeenCalledWith({
      data: { userId: 3, gymId: 2 },
    });
    expect(res).toBe("Trainer added successfully");
  });

  test("addTrainer forbids when user not trainer", async () => {
    jest.spyOn(service as any, "checkGymPermission").mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ userRole: "USER" } as any);
    await expect(service.addTrainer(1, 2, 3)).rejects.toThrow(
      "Target user must be a personal trainer"
    );
  });

  test("removeTrainer allows self removal", async () => {
    prisma.gymTrainer.delete.mockResolvedValue({} as any);
    const res = await service.removeTrainer(3, 2, 3);
    expect(prisma.gymTrainer.delete).toHaveBeenCalled();
    expect(res).toBe("Trainer removed successfully");
  });

  test("removeTrainer requires permission for others", async () => {
    const spy = jest
      .spyOn(service as any, "checkGymPermission")
      .mockResolvedValue(true);
    prisma.gymTrainer.delete.mockResolvedValue({} as any);
    await service.removeTrainer(1, 2, 3);
    expect(spy).toHaveBeenCalled();
  });

  test("assignEquipmentToGym creates when not existing", async () => {
    prisma.gymEquipment.findFirst.mockResolvedValue(null as any);
    prisma.gymEquipment.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { gymId: 1, equipmentId: 2, quantity: 3 };
    await service.assignEquipmentToGym(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gymEquipment.create).toHaveBeenCalled();
  });

  test("assignEquipmentToGym throws when exists", async () => {
    prisma.gymEquipment.findFirst.mockResolvedValue({ id: 1 } as any);
    await expect(
      service.assignEquipmentToGym({
        gymId: 1,
        equipmentId: 2,
        quantity: 1,
      } as any)
    ).rejects.toThrow("This equipment is already assigned to this gym");
  });

  test("updateGymEquipment updates record", async () => {
    prisma.gymEquipment.update.mockResolvedValue({ id: 1 } as any);
    const input: any = { gymEquipmentId: 1, quantity: 2 };
    await service.updateGymEquipment(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gymEquipment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: 2, note: undefined },
      include: { equipment: true, images: true },
    });
  });

  test("removeGymEquipment deletes equipment and images", async () => {
    prisma.gymEquipmentImage.deleteMany.mockResolvedValue({} as any);
    prisma.gymEquipment.delete.mockResolvedValue({} as any);
    const res = await service.removeGymEquipment(5);
    expect(prisma.gymEquipmentImage.deleteMany).toHaveBeenCalledWith({
      where: { gymEquipmentId: 5 },
    });
    expect(prisma.gymEquipment.delete).toHaveBeenCalledWith({
      where: { id: 5 },
    });
    expect(res).toBe(true);
  });

  test("uploadGymEquipmentImage creates image", async () => {
    prisma.gymEquipmentImage.create.mockResolvedValue({ id: "1" } as any);
    const input: any = {
      gymEquipmentId: 2,
      gymId: 1,
      equipmentId: 5,
      imageId: "img1",
    };
    await service.uploadGymEquipmentImage(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalledWith({
      data: {
        gymEquipmentId: 2,
        gymId: 1,
        equipmentId: 5,
        imageId: "img1",
      },
    });
  });

  test("deleteGymEquipmentImage deletes image", async () => {
    prisma.gymEquipmentImage.delete.mockResolvedValue({} as any);
    const res = await service.deleteGymEquipmentImage('3');
    expect(prisma.gymEquipmentImage.delete).toHaveBeenCalledWith({ where: { id: '3' } });
    expect(res).toBe(true);
  });

  test("getGymEquipment queries prisma", async () => {
    prisma.gymEquipment.findMany.mockResolvedValue([] as any);
    await service.getGymEquipment(1);
    expect(prisma.gymEquipment.findMany).toHaveBeenCalledWith({
      where: { gymId: 1 },
      include: { equipment: true, images: true },
    });
  });

  test("getGymEquipmentDetail queries prisma", async () => {
    prisma.gymEquipment.findUnique.mockResolvedValue({ id: 1 } as any);
    const res = await service.getGymEquipmentDetail(1);
    expect(prisma.gymEquipment.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { equipment: true, images: true },
    });
    expect(res).toEqual({ id: 1 });
  });
});
