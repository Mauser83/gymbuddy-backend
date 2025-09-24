import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { pubsub } from '../../../src/graphql/rootResolvers';
import { validateInput } from '../../../src/middlewares/validation';
import { kickBurstRunner } from '../../../src/modules/images/image-worker';
import { priorityFromSource } from '../../../src/modules/images/queue.service';
import { GymService } from '../../../src/modules/gym/gym.service';
import { assertSizeWithinLimit } from '../../../src/modules/media/media.utils';
import { copyObjectIfMissing, deleteObjectIgnoreMissing } from '../../../src/modules/media/media.service';
import { makeKey } from '../../../src/utils/makeKey';
import { ImageJobStatus, PrismaClient } from '../../../src/prisma';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/graphql/rootResolvers', () => ({
  pubsub: { publish: jest.fn() },
}));
jest.mock('../../../src/utils/makeKey');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('../../../src/modules/media/media.utils');
jest.mock('../../../src/modules/media/media.service');
jest.mock('../../../src/modules/images/image-worker');
jest.mock('../../../src/modules/images/queue.service');
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomUUID: jest.fn(() => 'mock-uuid') };
});

const mockedValidate = jest.mocked(validateInput as any);
const mockedPublish = jest.mocked(pubsub.publish);
const mockedMakeKey = jest.mocked(makeKey);
const mockedGetSignedUrl = jest.mocked(getSignedUrl);
const mockedAssertSizeWithinLimit = jest.mocked(assertSizeWithinLimit);
const mockedCopyObjectIfMissing = jest.mocked(copyObjectIfMissing);
const mockedDeleteObjectIgnoreMissing = jest.mocked(deleteObjectIgnoreMissing);
const mockedKickBurstRunner = jest.mocked(kickBurstRunner);
const mockedPriorityFromSource = jest.mocked(priorityFromSource);

describe('GymService', () => {
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
    mockedMakeKey.mockReturnValue('generated/storage/key.jpg');
    mockedGetSignedUrl.mockResolvedValue('https://signed.example');
    mockedAssertSizeWithinLimit.mockReturnValue(undefined);
    mockedCopyObjectIfMissing.mockResolvedValue(undefined);
    mockedDeleteObjectIgnoreMissing.mockResolvedValue(undefined);
    mockedKickBurstRunner.mockResolvedValue(undefined);
    mockedPriorityFromSource.mockReturnValue(5);
  });

  afterEach(() => jest.clearAllMocks());

  test('createGym creates gym and role when missing', async () => {
    prisma.gym.create.mockResolvedValue({ id: 1 } as any);
    prisma.gymManagementRole.findFirst.mockResolvedValue(null as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);

    const input: any = { name: 'g1', country: 'c', city: 'ct', address: 'a' };
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
      data: { gymId: 1, userId: 5, role: 'GYM_ADMIN' },
    });
    expect(mockedPublish).toHaveBeenCalled();
    expect(res).toEqual({ id: 1 });
  });

  test('createGym does not create role twice', async () => {
    prisma.gym.create.mockResolvedValue({ id: 1 } as any);
    prisma.gymManagementRole.findFirst.mockResolvedValue({ id: 99 } as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);

    await service.createGym(5, {
      name: 'g',
      country: 'c',
      city: 'ct',
      address: 'a',
    } as any);

    expect(prisma.gymManagementRole.create).not.toHaveBeenCalled();
  });

  test('getGyms requires auth', async () => {
    await expect(service.getGyms(undefined as any)).rejects.toThrow('Unauthorized');
  });

  test('getGyms passes search filters', async () => {
    prisma.gym.findMany.mockResolvedValue([] as any);
    await service.getGyms(1, 'abc');
    expect(prisma.gym.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  test('getGymById throws when not found', async () => {
    prisma.gym.findUnique.mockResolvedValue(null as any);
    await expect(service.getGymById(1, 1)).rejects.toThrow('Gym not found');
  });

  test('getGymById checks approval and roles', async () => {
    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [],
    } as any);
    await expect(service.getGymById(1, 2)).rejects.toThrow('Unauthorized');

    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [{ role: 'GYM_ADMIN' }],
    } as any);
    const g = await service.getGymById(1, 2);
    expect(g).toEqual({
      id: 1,
      isApproved: false,
      gymRoles: [{ role: 'GYM_ADMIN' }],
    });

    prisma.gym.findUnique.mockResolvedValue({
      id: 1,
      isApproved: false,
      gymRoles: [],
    } as any);
    const g2 = await service.getGymById(1, 2, 'ADMIN');
    expect(g2).toEqual({ id: 1, isApproved: false, gymRoles: [] });
  });

  test('getPendingGyms checks roles', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.gym.findMany.mockResolvedValue([] as any);
    await service.getPendingGyms(1);
    expect(prisma.gym.findMany).toHaveBeenCalledWith({
      where: { isApproved: false },
      orderBy: { createdAt: 'desc' },
      include: { creator: true },
    });
  });

  test('getPendingGyms forbidden when roles fail', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.getPendingGyms(1)).rejects.toThrow('Forbidden');
  });

  test('approveGym updates and publishes', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: ['ADMIN'] });
    permissionService.verifyAppRoles.mockReturnValue(true);
    prisma.gym.update.mockResolvedValue({ id: 1 } as any);
    prisma.gym.findUnique.mockResolvedValue({ id: 1 } as any);
    const res = await service.approveGym(1, 1);
    expect(prisma.gym.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isApproved: true },
    });
    expect(mockedPublish).toHaveBeenCalled();
    expect(res).toBe('Gym approved successfully');
  });

  test('approveGym forbidden when roles fail', async () => {
    permissionService.getUserRoles.mockResolvedValue({ appRoles: [] });
    permissionService.verifyAppRoles.mockReturnValue(false);
    await expect(service.approveGym(1, 1)).rejects.toThrow('Forbidden');
  });

  test('updateGym requires permission when not admin', async () => {
    const spy = jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.gym.update.mockResolvedValue({ id: 1 } as any);
    await service.updateGym(1, 2, { name: 'n' } as any, 'USER');
    expect(spy).toHaveBeenCalled();
    expect(prisma.gym.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { name: 'n' },
    });
  });

  test('updateGym throws when permission denied', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(false);
    await expect(service.updateGym(1, 2, {} as any, 'USER')).rejects.toThrow(
      'Insufficient gym permissions',
    );
  });

  test('deleteGym requires permission when not admin', async () => {
    const spy = jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.gym.delete.mockResolvedValue({} as any);
    const res = await service.deleteGym(1, 2, 'USER');
    expect(spy).toHaveBeenCalled();
    expect(prisma.gym.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(res).toBe('Gym deleted successfully');
  });

  test('deleteGym throws when permission denied', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(false);
    await expect(service.deleteGym(1, 2, 'USER')).rejects.toThrow('Unauthorized');
  });

  test('addTrainer checks roles and user type', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      userRole: 'PERSONAL_TRAINER',
    } as any);
    prisma.gymTrainer.create.mockResolvedValue({} as any);
    const res = await service.addTrainer(1, 2, 3);
    expect(prisma.gymTrainer.create).toHaveBeenCalledWith({
      data: { userId: 3, gymId: 2 },
    });
    expect(res).toBe('Trainer added successfully');
  });

  test('addTrainer forbids when user not trainer', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({ userRole: 'USER' } as any);
    await expect(service.addTrainer(1, 2, 3)).rejects.toThrow(
      'Target user must be a personal trainer',
    );
  });

  test('removeTrainer allows self removal', async () => {
    prisma.gymTrainer.delete.mockResolvedValue({} as any);
    const res = await service.removeTrainer(3, 2, 3);
    expect(prisma.gymTrainer.delete).toHaveBeenCalled();
    expect(res).toBe('Trainer removed successfully');
  });

  test('removeTrainer requires permission for others', async () => {
    const spy = jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.gymTrainer.delete.mockResolvedValue({} as any);
    await service.removeTrainer(1, 2, 3);
    expect(spy).toHaveBeenCalled();
  });

  test('assignEquipmentToGym creates when not existing', async () => {
    prisma.gymEquipment.findFirst.mockResolvedValue(null as any);
    prisma.gymEquipment.create.mockResolvedValue({ id: 1 } as any);
    const input: any = { gymId: 1, equipmentId: 2, quantity: 3 };
    await service.assignEquipmentToGym(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gymEquipment.create).toHaveBeenCalled();
  });

  test('assignEquipmentToGym throws when exists', async () => {
    prisma.gymEquipment.findFirst.mockResolvedValue({ id: 1 } as any);
    await expect(
      service.assignEquipmentToGym({
        gymId: 1,
        equipmentId: 2,
        quantity: 1,
      } as any),
    ).rejects.toThrow('This equipment is already assigned to this gym');
  });

  test('updateGymEquipment updates record', async () => {
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

  test('removeGymEquipment deletes equipment and images', async () => {
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

  test('uploadGymImage creates image', async () => {
    prisma.gymEquipment.findFirst.mockResolvedValue({ id: 10 } as any);
    prisma.equipmentImage.create.mockResolvedValue({ id: 'img1' } as any);
    prisma.gymEquipmentImage.create.mockResolvedValue({ id: '1' } as any);
    const input: any = {
      gymId: 1,
      equipmentId: 5,
      storageKey: 'key.jpg',
      sha256: 'abc',
    };
    await service.uploadGymImage(input);
    expect(mockedValidate).toHaveBeenCalledWith(input, expect.any(Function));
    expect(prisma.gymEquipment.findFirst).toHaveBeenCalledWith({
      where: { gymId: 1, equipmentId: 5 },
      select: { id: true },
    });
    expect(prisma.equipmentImage.create).toHaveBeenCalledWith({
      data: { equipmentId: 5, storageKey: 'key.jpg', sha256: 'abc' },
    });
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalledWith({
      data: {
        gymEquipmentId: 10,
        gymId: 1,
        equipmentId: 5,
        imageId: 'img1',
        status: undefined,
      },
    });
  });

  test('deleteGymImage deletes and promotes next when primary', async () => {
    prisma.gymEquipmentImage.findUnique.mockResolvedValue({
      gymId: 1,
      gymEquipmentId: 10,
      isPrimary: true,
    } as any);
    const tx = {
      gymEquipmentImage: {
        delete: jest.fn().mockResolvedValue({ isPrimary: true, gymEquipmentId: 10 } as any),
        findFirst: jest.fn().mockResolvedValue({ id: 'next' } as any),
        update: jest.fn().mockResolvedValue({} as any),
      },
    } as any;
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    const res = await service.deleteGymImage(5, '3');
    expect(tx.gymEquipmentImage.delete).toHaveBeenCalledWith({ where: { id: '3' } });
    expect(tx.gymEquipmentImage.update).toHaveBeenCalledWith({
      where: { id: 'next' },
      data: { isPrimary: true },
    });
    expect(res).toBe(true);
  });

  test('setPrimaryGymEquipmentImage swaps primary', async () => {
    prisma.gymEquipmentImage.findUnique.mockResolvedValue({
      gymId: 1,
      gymEquipmentId: 10,
    } as any);
    const tx = {
      gymEquipmentImage: {
        updateMany: jest.fn().mockResolvedValue({} as any),
        update: jest.fn().mockResolvedValue({ id: 'img2', isPrimary: true } as any),
      },
    } as any;
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    const res = await service.setPrimaryGymEquipmentImage(5, 'img2');
    expect(tx.gymEquipmentImage.updateMany).toHaveBeenCalledWith({
      where: { gymEquipmentId: 10, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.gymEquipmentImage.update).toHaveBeenCalledWith({
      where: { id: 'img2' },
      data: { isPrimary: true },
    });
    expect(res).toEqual({ id: 'img2', isPrimary: true });
  });

  test('getGymEquipmentDetail queries prisma', async () => {
    prisma.gymEquipment.findUnique.mockResolvedValue({ id: 1 } as any);
    const res = await service.getGymEquipmentDetail(1);
    expect(prisma.gymEquipment.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        gym: true,
        equipment: {
          include: {
            category: true,
            subcategory: true,
            images: true,
          },
        },
        images: true,
      },
    });
    expect(res).toEqual({ id: 1 });
  });

  test('getGymImagesByGymId fetches descending images', async () => {
    prisma.gymEquipmentImage.findMany.mockResolvedValue([{ id: 'img1' }] as any);

    const rows = await service.getGymImagesByGymId(7);

    expect(prisma.gymEquipmentImage.findMany).toHaveBeenCalledWith({
      where: { gymId: 7 },
      orderBy: { capturedAt: 'desc' },
      include: { image: true },
    });
    expect(rows).toEqual([{ id: 'img1' }]);
  });

  test('getGymImageById loads image relation', async () => {
    prisma.gymEquipmentImage.findUnique.mockResolvedValue({ id: 'img1' } as any);

    const row = await service.getGymImageById('img1');

    expect(prisma.gymEquipmentImage.findUnique).toHaveBeenCalledWith({
      where: { id: 'img1' },
      include: { image: true },
    });
    expect(row).toEqual({ id: 'img1' });
  });

  test('getGymEquipment returns detailed equipment list', async () => {
    prisma.gymEquipment.findMany.mockResolvedValue([{ id: 3 }] as any);

    const rows = await service.getGymEquipment(9);

    expect(prisma.gymEquipment.findMany).toHaveBeenCalledWith({
      where: { gymId: 9 },
      include: { equipment: true, images: true },
    });
    expect(rows).toEqual([{ id: 3 }]);
  });

  test('listGymEquipmentImages enforces permissions and paginates', async () => {
    prisma.gymEquipment.findUnique.mockResolvedValue({ gymId: 2 } as any);
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.gymEquipmentImage.findMany.mockResolvedValue([
      { id: 'first' },
      { id: 'second' },
    ] as any);

    const res = await service.listGymEquipmentImages(5, 10, 1);

    expect(prisma.gymEquipmentImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gymEquipmentId: 10 },
        take: 2,
      }),
    );
    expect(res).toEqual({ items: [{ id: 'first' }], nextCursor: 'second' });
  });

  test('listGymEquipmentImages rejects unauthorized users', async () => {
    prisma.gymEquipment.findUnique.mockResolvedValue({ gymId: 2 } as any);
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(false);

    await expect(service.listGymEquipmentImages(5, 10)).rejects.toThrow('Unauthorized');
  });

  test('createAdminUploadTicket validates payload and builds headers', async () => {
    const result = await service.createAdminUploadTicket({
      gymId: 3,
      requestedByUserId: 7,
      ttlSec: 120,
      upload: {
        ext: 'JPG',
        contentLength: 123,
        contentType: '',
      },
    });

    expect(mockedAssertSizeWithinLimit).toHaveBeenCalledWith(123);
    expect(mockedMakeKey).toHaveBeenCalledWith('upload', { gymId: 3 }, { ext: 'jpg' });
    expect(mockedGetSignedUrl).toHaveBeenCalled();
    expect(result).toMatchObject({
      storageKey: 'generated/storage/key.jpg',
      requiredHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }],
    });
  });

  test('createAdminUploadTicket rejects unsupported extension', async () => {
    await expect(
      service.createAdminUploadTicket({
        gymId: 1,
        requestedByUserId: 2,
        ttlSec: 60,
        upload: { ext: 'gif', contentLength: 1 },
      }),
    ).rejects.toThrow('Unsupported image extension');
  });

  test('createEquipmentTrainingUploadTicket validates access', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);

    const result = await service.createEquipmentTrainingUploadTicket(
      9,
      2,
      5,
      { ext: 'webp', contentLength: 321 } as any,
    );

    expect(mockedAssertSizeWithinLimit).toHaveBeenCalledWith(321);
    expect(mockedGetSignedUrl).toHaveBeenCalled();
    expect(result.storageKey).toMatch(/^private\/uploads\/gym\/5\/mock-uuid\.webp$/);
  });

  test('createEquipmentTrainingUploadTicket rejects unauthorized', async () => {
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(false);

    await expect(
      service.createEquipmentTrainingUploadTicket(1, 2, 3, { ext: 'png', contentLength: 1 } as any),
    ).rejects.toThrow('Unauthorized');
  });

  test('finalizeEquipmentTrainingImage copies object, enqueues jobs, and kicks worker', async () => {
    prisma.gymEquipment.findUnique.mockResolvedValue({ gymId: 4, equipmentId: 6 } as any);
    jest.spyOn(service as any, 'checkGymPermission').mockResolvedValue(true);
    prisma.gymEquipmentImage.create.mockResolvedValue({ id: 'img-1' } as any);
    prisma.trainingCandidate.create.mockResolvedValue({} as any);
    prisma.imageQueue.create.mockResolvedValue({} as any);
    mockedPriorityFromSource.mockReturnValue(9);

    const immediate = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation((fn: any) => {
        fn();
        return {} as any;
      });

    const result = await service.finalizeEquipmentTrainingImage(
      10,
      12,
      'private/uploads/gym/6/original-uuid.png',
    );

    expect(mockedCopyObjectIfMissing).toHaveBeenCalledWith(
      'private/uploads/gym/6/original-uuid.png',
      expect.stringMatching(/^private\/gym\/12\/approved\/mock-uuid\.png$/),
    );
    expect(mockedDeleteObjectIgnoreMissing).toHaveBeenCalledWith('private/uploads/gym/6/original-uuid.png');
    expect(prisma.trainingCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'gym_equipment',
          gymId: 4,
          gymEquipmentId: 12,
        }),
      }),
    );
    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobType: 'HASH',
        priority: 9,
        status: ImageJobStatus.pending,
      }),
    });
    expect(mockedKickBurstRunner).toHaveBeenCalled();
    expect(result).toEqual({ id: 'img-1' });
    immediate.mockRestore();
  });

  test('getImageProcessingStatus returns immediate status when no job enqueued', async () => {
    prisma.gymEquipmentImage.findUnique.mockResolvedValue({
      status: 'APPROVED',
      storageKey: 'key',
    } as any);
    prisma.imageQueue.findFirst.mockResolvedValue(null as any);

    const res = await service.getImageProcessingStatus('img-1');

    expect(res).toEqual({
      status: 'APPROVED',
      queuePosition: 0,
      etaSeconds: 0,
      attempts: 0,
      scheduledAt: null,
      priority: 0,
    });
  });

  test('getImageProcessingStatus returns queue details when job pending', async () => {
    prisma.gymEquipmentImage.findUnique.mockResolvedValue({
      status: 'PENDING',
      storageKey: 'approved-key',
    } as any);
    const createdAt = new Date('2023-01-01T00:00:00.000Z');
    const scheduledAt = new Date('2023-01-02T00:00:00.000Z');
    prisma.imageQueue.findFirst.mockResolvedValue({
      priority: 3,
      createdAt,
      attempts: 2,
      scheduledAt,
    } as any);
    prisma.$queryRaw.mockResolvedValue([{ totalahead: BigInt(4) }] as any);
    process.env.THROUGHPUT_JOBS_PER_MIN = '40';

    const res = await service.getImageProcessingStatus('img-2');

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(res).toEqual({
      status: 'PENDING',
      queuePosition: 4,
      etaSeconds: Math.ceil((4 * 60) / 40),
      attempts: 2,
      scheduledAt: scheduledAt.toISOString(),
      priority: 3,
    });
  });
});