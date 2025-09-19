import { GymResolvers } from '../../../src/modules/gym/gym.resolvers';
import { GymService } from '../../../src/modules/gym/gym.service';
import { PermissionService } from '../../../src/modules/core/permission.service';

jest.mock('../../../src/modules/gym/gym.service');

const mockedService = jest.mocked(GymService);

function createContext() {
  return {
    prisma: {
      gymManagementRole: { findMany: jest.fn() },
      gymEquipment: { findMany: jest.fn(), findUnique: jest.fn() },
      gymTrainer: { findMany: jest.fn(), delete: jest.fn(), create: jest.fn() },
      exerciseLogEquipment: { findMany: jest.fn() },
    } as any,
    userId: 1,
    appRole: 'USER',
    permissionService: new PermissionService({} as any),
  } as any;
}

describe('GymResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
  });

  describe('field resolvers', () => {
    test('Gym.gymRoles', async () => {
      const ctx = createContext();
      ctx.prisma.gymManagementRole.findMany.mockResolvedValue([]);
      await GymResolvers.Gym.gymRoles({ id: 1 }, {}, ctx);
      expect(ctx.prisma.gymManagementRole.findMany).toHaveBeenCalledWith({
        where: { gymId: 1 },
        include: { user: true },
      });
    });

    test('Gym.gymEquipment', async () => {
      const ctx = createContext();
      ctx.prisma.gymEquipment.findMany.mockResolvedValue([]);
      await GymResolvers.Gym.gymEquipment({ id: 1 }, {}, ctx);
      expect(ctx.prisma.gymEquipment.findMany).toHaveBeenCalledWith({
        where: { gymId: 1 },
        include: { equipment: true, images: true },
      });
    });

    test('Gym.trainers', async () => {
      const ctx = createContext();
      ctx.prisma.gymTrainer.findMany.mockResolvedValue([]);
      await GymResolvers.Gym.trainers({ id: 1 }, {}, ctx);
      expect(ctx.prisma.gymTrainer.findMany).toHaveBeenCalledWith({
        where: { gymId: 1 },
        include: { user: true },
      });
    });

    test('Gym.exerciseLogs aggregates logs', async () => {
      const ctx = createContext();
      ctx.prisma.gymEquipment.findMany.mockResolvedValue([{ id: 2 }]);
      ctx.prisma.exerciseLogEquipment.findMany.mockResolvedValue([
        { exerciseLog: { id: 3 } },
      ] as any);
      const res = await GymResolvers.Gym.exerciseLogs({ id: 1 }, {}, ctx);
      expect(ctx.prisma.exerciseLogEquipment.findMany).toHaveBeenCalled();
      expect(res).toEqual([{ id: 3 }]);
    });
  });

  describe('Query resolvers', () => {
    test('gyms uses service', async () => {
      const instance = { getGyms: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.gyms(null as any, { search: 's' }, ctx);
      expect(instance.getGyms).toHaveBeenCalledWith(1, 's');
    });

    test('gym requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(GymResolvers.Query.gym(null as any, { id: 1 }, ctx)).rejects.toThrow(
        'Unauthenticated',
      );
    });

    test('gym uses service', async () => {
      const instance = { getGymById: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.gym(null as any, { id: 2 }, ctx);
      expect(instance.getGymById).toHaveBeenCalledWith(2, 1, 'USER');
    });

    test('pendingGyms uses service', async () => {
      const instance = { getPendingGyms: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.pendingGyms(null as any, {}, ctx);
      expect(instance.getPendingGyms).toHaveBeenCalledWith(1);
    });

    test('getGymEquipment uses service', async () => {
      const instance = { getGymEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.getGymEquipment(null as any, { gymId: 1 }, ctx);
      expect(instance.getGymEquipment).toHaveBeenCalledWith(1);
    });

    test('getGymEquipmentDetail uses service', async () => {
      const instance = { getGymEquipmentDetail: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.getGymEquipmentDetail(null as any, { gymEquipmentId: 2 }, ctx);
      expect(instance.getGymEquipmentDetail).toHaveBeenCalledWith(2);
    });

    test('gymImagesByGymId uses service', async () => {
      const instance = { getGymImagesByGymId: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.gymImagesByGymId(null as any, { gymId: 1 }, ctx);
      expect(instance.getGymImagesByGymId).toHaveBeenCalledWith(1);
    });

    test('gymImage uses service', async () => {
      const instance = { getGymImageById: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.gymImage(null as any, { id: 'img1' }, ctx);
      expect(instance.getGymImageById).toHaveBeenCalledWith('img1');
    });
  });

  describe('Mutation resolvers', () => {
    test('createGym requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.createGym(null as any, { input: {} as any }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('createGym uses service', async () => {
      const instance = { createGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.createGym(null as any, { input: { a: 1 } } as any, ctx);
      expect(instance.createGym).toHaveBeenCalled();
    });

    test('updateGym requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.updateGym(null as any, { id: 1, input: {} }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('updateGym uses service', async () => {
      const instance = { updateGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.updateGym(null as any, { id: 1, input: {} }, ctx);
      expect(instance.updateGym).toHaveBeenCalledWith(1, 1, {}, 'USER');
    });

    test('approveGym uses service', async () => {
      const instance = { approveGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.approveGym(null as any, { gymId: 2 }, ctx);
      expect(instance.approveGym).toHaveBeenCalledWith(1, 2);
    });

    test('deleteGym uses service', async () => {
      const instance = { deleteGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.deleteGym(null as any, { id: 3 }, ctx);
      expect(instance.deleteGym).toHaveBeenCalledWith(1, 3, 'USER');
    });

    test('addTrainer uses service', async () => {
      const instance = { addTrainer: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.addTrainer(null as any, { gymId: 1, userId: 2 }, ctx);
      expect(instance.addTrainer).toHaveBeenCalledWith(1, 1, 2);
    });

    test('removeTrainer uses service', async () => {
      const instance = { removeTrainer: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.removeTrainer(null as any, { gymId: 1, userId: 2 }, ctx);
      expect(instance.removeTrainer).toHaveBeenCalledWith(1, 1, 2);
    });

    test('assignEquipmentToGym uses service', async () => {
      const instance = { assignEquipmentToGym: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.assignEquipmentToGym(
        null as any,
        { input: { a: 1 } } as any,
        ctx,
      );
      expect(instance.assignEquipmentToGym).toHaveBeenCalled();
    });

    test('updateGymEquipment uses service', async () => {
      const instance = { updateGymEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.updateGymEquipment(null as any, { input: {} } as any, ctx);
      expect(instance.updateGymEquipment).toHaveBeenCalled();
    });

    test('removeGymEquipment uses service', async () => {
      const instance = { removeGymEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.removeGymEquipment(null as any, { gymEquipmentId: 1 }, ctx);
      expect(instance.removeGymEquipment).toHaveBeenCalledWith(1);
    });

    test('uploadGymImage uses service', async () => {
      const instance = { uploadGymImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.uploadGymImage(null as any, { input: {} } as any, ctx);
      expect(instance.uploadGymImage).toHaveBeenCalled();
    });

    test('deleteGymImage uses service', async () => {
      const instance = { deleteGymImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.deleteGymImage(null as any, { imageId: '2' }, ctx);
      expect(instance.deleteGymImage).toHaveBeenCalledWith(1, '2');
    });

    test('setPrimaryGymEquipmentImage uses service', async () => {
      const instance = { setPrimaryGymEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.setPrimaryGymEquipmentImage(null as any, { imageId: '1' }, ctx);
      expect(instance.setPrimaryGymEquipmentImage).toHaveBeenCalledWith(1, '1');
    });

    test('finalizeGymImagesAdmin requires admin', async () => {
      const ctx = {
        userId: 1,
        appRole: 'USER',
        imageIntakeService: { finalizeGymImagesAdmin: jest.fn() },
      } as any;
      await expect(
        GymResolvers.Mutation.finalizeGymImagesAdmin(
          null as any,
          { input: { gymId: 1, equipmentId: 2, storageKeys: ['k'] } },
          ctx,
        ),
      ).rejects.toThrow('Forbidden');
    });

    test('finalizeGymImagesAdmin normalizes and calls service', async () => {
      const service = { finalizeGymImagesAdmin: jest.fn() };
      const ctx = {
        userId: 5,
        appRole: 'ADMIN',
        imageIntakeService: service,
      } as any;
      await GymResolvers.Mutation.finalizeGymImagesAdmin(
        null as any,
        { input: { gymId: 3, equipmentId: 4, storageKeys: ['a', 'b'] } },
        ctx,
      );
      expect(service.finalizeGymImagesAdmin).toHaveBeenCalledWith(
        {
          defaults: { gymId: 3, equipmentId: 4 },
          items: [{ storageKey: 'a' }, { storageKey: 'b' }],
        },
        5,
      );
    });
  });
});
