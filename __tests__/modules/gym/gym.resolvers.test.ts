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

    test('gymById requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(GymResolvers.Query.gymById(null as any, { id: 1 }, ctx)).rejects.toThrow('Unauthenticated');
    });

    test('gymById uses service', async () => {
      const instance = { getGymById: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.gymById(null as any, { id: 2 }, ctx);
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
  });

  describe('Mutation resolvers', () => {
    test('createGym requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(GymResolvers.Mutation.createGym(null as any, { input: {} as any }, ctx)).rejects.toThrow('Unauthenticated');
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
      await expect(GymResolvers.Mutation.updateGym(null as any, { id: 1, input: {} }, ctx)).rejects.toThrow('Unauthenticated');
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
      await GymResolvers.Mutation.assignEquipmentToGym(null as any, { input: { a: 1 } } as any, ctx);
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

    test('uploadGymEquipmentImage uses service', async () => {
      const instance = { uploadGymEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.uploadGymEquipmentImage(null as any, { input: {} } as any, ctx);
      expect(instance.uploadGymEquipmentImage).toHaveBeenCalled();
    });

    test('deleteGymEquipmentImage uses service', async () => {
      const instance = { deleteGymEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.deleteGymEquipmentImage(null as any, { imageId: 2 }, ctx);
      expect(instance.deleteGymEquipmentImage).toHaveBeenCalledWith(2);
    });
  });
});