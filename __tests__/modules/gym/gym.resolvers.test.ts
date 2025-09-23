import { AppRole } from '../../../src/modules/auth/auth.types';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { GymResolvers } from '../../../src/modules/gym/gym.resolvers';
import { GymService } from '../../../src/modules/gym/gym.service';

jest.mock('../../../src/modules/gym/gym.service');

const mockedService = jest.mocked(GymService);

function createContext() {
  return {
    prisma: {
      gymManagementRole: { findMany: jest.fn() },
      gymEquipment: { findMany: jest.fn(), findUnique: jest.fn() },
      gymTrainer: { findMany: jest.fn(), delete: jest.fn(), create: jest.fn() },
      exerciseLogEquipment: { findMany: jest.fn() },
      gymEquipmentImage: { findMany: jest.fn() },
      user: { findUnique: jest.fn() },
    } as any,
    userId: 1,
    appRole: undefined as AppRole | undefined,
    permissionService: new PermissionService({} as any),
    mediaService: { presignGetForKey: jest.fn() },
    imageIntakeService: { finalizeGymImagesAdmin: jest.fn() },
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

    test('Gym.images queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.gymEquipmentImage.findMany.mockResolvedValue([]);
      await GymResolvers.Gym.images({ id: 5 }, {}, ctx);
      expect(ctx.prisma.gymEquipmentImage.findMany).toHaveBeenCalledWith({
        where: { gymId: 5 },
        include: { image: true },
        orderBy: { capturedAt: 'desc' },
      });
    });
  });

  describe('GymEquipmentImage resolvers', () => {
    test('capturedAt prefers capturedAt field', () => {
      const result = GymResolvers.GymEquipmentImage.capturedAt({ capturedAt: 'now' } as any);
      expect(result).toBe('now');
    });

    test('capturedAt falls back to updatedAt then epoch', () => {
      const fallback = GymResolvers.GymEquipmentImage.capturedAt({ updatedAt: 'later' } as any);
      const defaultValue = GymResolvers.GymEquipmentImage.capturedAt({} as any);
      expect(fallback).toBe('later');
      expect(defaultValue).toBe(new Date(0).toISOString());
    });

    test('createdAt mirrors capturedAt logic', () => {
      const fallback = GymResolvers.GymEquipmentImage.createdAt({ updatedAt: 'time' } as any);
      expect(fallback).toBe('time');
    });

    test('thumbUrl returns null without storage key', async () => {
      const ctx = createContext();
      const res = await GymResolvers.GymEquipmentImage.thumbUrl({ storageKey: '' } as any, {}, ctx);
      expect(res).toBeNull();
      expect(ctx.mediaService.presignGetForKey).not.toHaveBeenCalled();
    });

    test('thumbUrl defaults ttl and returns value', async () => {
      const ctx = createContext();
      ctx.mediaService.presignGetForKey.mockResolvedValue('signed');
      const res = await GymResolvers.GymEquipmentImage.thumbUrl({ storageKey: 'key' } as any, {}, ctx);
      expect(ctx.mediaService.presignGetForKey).toHaveBeenCalledWith('key', 300);
      expect(res).toBe('signed');
    });

    test('thumbUrl accepts ttl argument', async () => {
      const ctx = createContext();
      ctx.mediaService.presignGetForKey.mockResolvedValue('signed');
      await GymResolvers.GymEquipmentImage.thumbUrl({ storageKey: 'key' } as any, { ttlSec: 120 }, ctx);
      expect(ctx.mediaService.presignGetForKey).toHaveBeenCalledWith('key', 120);
    });

    test('url returns null without storage key', async () => {
      const ctx = createContext();
      const res = await GymResolvers.GymEquipmentImage.url({ storageKey: '' } as any, {}, ctx);
      expect(res).toBeNull();
    });

    test('url presigns with default ttl', async () => {
      const ctx = createContext();
      ctx.mediaService.presignGetForKey.mockResolvedValue('signed');
      const res = await GymResolvers.GymEquipmentImage.url({ storageKey: 'key' } as any, {}, ctx);
      expect(ctx.mediaService.presignGetForKey).toHaveBeenCalledWith('key', 300);
      expect(res).toBe('signed');
    });

    test('approvedBy returns cached user when present', async () => {
      const ctx = createContext();
      const res = await GymResolvers.GymEquipmentImage.approvedBy({ approvedByUser: { id: 1 } } as any, {}, ctx);
      expect(res).toEqual({ id: 1 });
      expect(ctx.prisma.user.findUnique).not.toHaveBeenCalled();
    });

    test('approvedBy looks up user when id provided', async () => {
      const ctx = createContext();
      ctx.prisma.user.findUnique.mockResolvedValue({ id: 2 });
      const res = await GymResolvers.GymEquipmentImage.approvedBy({ approvedByUserId: 2 } as any, {}, ctx);
      expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toEqual({ id: 2 });
    });

    test('approvedBy returns null when no information', async () => {
      const ctx = createContext();
      const res = await GymResolvers.GymEquipmentImage.approvedBy({}, {}, ctx);
      expect(res).toBeNull();
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
      expect(instance.getGymById).toHaveBeenCalledWith(2, 1, undefined);
    });

    test('pendingGyms uses service', async () => {
      const instance = { getPendingGyms: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.pendingGyms(null as any, {}, ctx);
      expect(instance.getPendingGyms).toHaveBeenCalledWith(1);
    });

    test('pendingGyms requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(GymResolvers.Query.pendingGyms(null as any, {}, ctx)).rejects.toThrow(
        'Unauthenticated',
      );
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

    test('listGymEquipmentImages requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Query.listGymEquipmentImages(null as any, { gymEquipmentId: 1 }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('listGymEquipmentImages uses service', async () => {
      const instance = { listGymEquipmentImages: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.listGymEquipmentImages(
        null as any,
        { gymEquipmentId: 3, limit: 4, cursor: 'c' },
        ctx,
      );
      expect(instance.listGymEquipmentImages).toHaveBeenCalledWith(1, 3, 4, 'c');
    });

    test('getImageProcessingStatus uses service', async () => {
      const instance = { getImageProcessingStatus: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Query.getImageProcessingStatus(null as any, { imageId: 'img' }, ctx);
      expect(instance.getImageProcessingStatus).toHaveBeenCalledWith('img');
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
      expect(instance.updateGym).toHaveBeenCalledWith(1, 1, {}, undefined);
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
      expect(instance.deleteGym).toHaveBeenCalledWith(1, 3, undefined);
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

    test('deleteGymImage requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.deleteGymImage(null as any, { imageId: '2' }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('setPrimaryGymEquipmentImage uses service', async () => {
      const instance = { setPrimaryGymEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.setPrimaryGymEquipmentImage(null as any, { imageId: '1' }, ctx);
      expect(instance.setPrimaryGymEquipmentImage).toHaveBeenCalledWith(1, '1');
    });

    test('setPrimaryGymEquipmentImage requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.setPrimaryGymEquipmentImage(null as any, { imageId: '1' }, ctx),
      ).rejects.toThrow('Unauthenticated');
    });

    test('finalizeGymImagesAdmin requires admin', async () => {
      const ctx = {
        userId: 1,
        appRole: AppRole.MODERATOR,
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
        appRole: AppRole.ADMIN,
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

    test('createAdminUploadTicket requires admin role', async () => {
      const ctx = createContext();
      ctx.appRole = AppRole.MODERATOR;
      await expect(
        GymResolvers.Mutation.createAdminUploadTicket(
          null as any,
          { input: { gymId: 1, upload: {} } } as any,
          ctx,
        ),
      ).rejects.toThrow('Forbidden');
    });

    test('createAdminUploadTicket requires user id', async () => {
      const ctx = createContext();
      ctx.appRole = AppRole.ADMIN;
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.createAdminUploadTicket(
          null as any,
          { input: { gymId: 1, upload: {} } } as any,
          ctx,
        ),
      ).rejects.toThrow('Unauthenticated');
    });

    test('createAdminUploadTicket uses default ttl', async () => {
      const instance = { createAdminUploadTicket: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      ctx.appRole = AppRole.ADMIN;
      await GymResolvers.Mutation.createAdminUploadTicket(
        null as any,
        { input: { gymId: 2, upload: { path: 'p' } } } as any,
        ctx,
      );
      expect(instance.createAdminUploadTicket).toHaveBeenCalledWith({
        gymId: 2,
        upload: { path: 'p' },
        ttlSec: 600,
        requestedByUserId: 1,
      });
    });

    test('createAdminUploadTicket forwards ttl', async () => {
      const instance = { createAdminUploadTicket: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      ctx.appRole = AppRole.ADMIN;
      await GymResolvers.Mutation.createAdminUploadTicket(
        null as any,
        { input: { gymId: 2, upload: {}, ttlSec: 30 } } as any,
        ctx,
      );
      expect(instance.createAdminUploadTicket).toHaveBeenCalledWith({
        gymId: 2,
        upload: {},
        ttlSec: 30,
        requestedByUserId: 1,
      });
    });

    test('createEquipmentTrainingUploadTicket requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.createEquipmentTrainingUploadTicket(
          null as any,
          { gymId: 1, equipmentId: 2, input: {} } as any,
          ctx,
        ),
      ).rejects.toThrow('Unauthenticated');
    });

    test('createEquipmentTrainingUploadTicket uses service', async () => {
      const instance = { createEquipmentTrainingUploadTicket: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.createEquipmentTrainingUploadTicket(
        null as any,
        { gymId: 3, equipmentId: 4, input: { x: 1 } } as any,
        ctx,
      );
      expect(instance.createEquipmentTrainingUploadTicket).toHaveBeenCalledWith(1, 3, 4, { x: 1 });
    });

    test('finalizeEquipmentTrainingImage requires auth', async () => {
      const ctx = createContext();
      ctx.userId = undefined as any;
      await expect(
        GymResolvers.Mutation.finalizeEquipmentTrainingImage(
          null as any,
          { gymEquipmentId: 1, storageKey: 'key' },
          ctx,
        ),
      ).rejects.toThrow('Unauthenticated');
    });

    test('finalizeEquipmentTrainingImage uses service', async () => {
      const instance = { finalizeEquipmentTrainingImage: jest.fn() } as any;
      mockedService.mockImplementation(() => instance);
      const ctx = createContext();
      await GymResolvers.Mutation.finalizeEquipmentTrainingImage(
        null as any,
        { gymEquipmentId: 1, storageKey: 'key' },
        ctx,
      );
      expect(instance.finalizeEquipmentTrainingImage).toHaveBeenCalledWith(1, 1, 'key');
    });
  });
});
