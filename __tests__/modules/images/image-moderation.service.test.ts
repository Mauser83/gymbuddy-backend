jest.mock('../../../src/modules/images/image-worker', () => ({
  // Ensure kickBurstRunner returns a Promise so calling code can attach .catch
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

import { ImageModerationService } from '../../../src/modules/images/image-moderation.service';
import { PrismaClient } from '../../../src/lib/prisma';
import { AuthContext, UserRole } from '../../../src/modules/auth/auth.types';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { cleanDB, prisma } from '../../testUtils';
import { AdminImageListStatusDto } from '../../../src/modules/images/images.dto';

jest.spyOn(S3Client.prototype, 'send').mockImplementation((cmd: any) => {
  return Promise.resolve({} as any);
});

describe('ImageModerationService', () => {
  const baseCtx: AuthContext = {
    userId: 1,
    appRole: 'ADMIN',
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
      imageQueue: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as unknown as PrismaClient;
  }

  it('approves image and enqueues embed', async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: 'g1',
      gymId: 1,
      storageKey: 'private/uploads/tmp.jpg',
      status: 'PENDING',
      isSafe: true,
    });
    (prismaMock.gymEquipmentImage.update as any).mockResolvedValue({
      id: 'g1',
      approvedAt: new Date(),
      approvedByUserId: 1,
    });
    (prismaMock.$queryRaw as any).mockResolvedValue([{ has: false }]);
    const svc = new ImageModerationService(prismaMock);
    const res = await svc.approveGymImage({ id: 'g1' }, baseCtx);
    expect(res.gymImage.id).toBe('g1');
    expect(res.gymImage.approvedAt).toBeInstanceOf(Date);
    expect(res.gymImage.approvedByUserId).toBe(1);
    expect(prismaMock.gymEquipmentImage.update).toHaveBeenCalled();
    expect(prismaMock.imageQueue.create).toHaveBeenCalled();
    expect(S3Client.prototype.send).toHaveBeenCalled();
  });

  it('blocks unsafe approval unless forced', async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: 'g1',
      gymId: 1,
      storageKey: 'key',
      status: 'PENDING',
      isSafe: false,
    });
    const svc = new ImageModerationService(prismaMock);
    await expect(svc.approveGymImage({ id: 'g1' }, baseCtx)).rejects.toThrow();
    (prismaMock.$queryRaw as any).mockResolvedValue([{ has: false }]);
    await expect(svc.approveGymImage({ id: 'g1', force: true }, baseCtx)).resolves.toBeDefined();
  });

  it('reject deletes object when requested', async () => {
    const prismaMock = createPrismaMock();
    (prismaMock.gymEquipmentImage.findUniqueOrThrow as any).mockResolvedValue({
      id: 'g1',
      gymId: 1,
      storageKey: 'key',
    });
    (prismaMock.gymEquipmentImage.update as any).mockResolvedValue({
      id: 'g1',
      gymId: 1,
      storageKey: 'key',
      status: 'REJECTED',
    });
    const svc = new ImageModerationService(prismaMock);
    await svc.rejectGymImage({ id: 'g1', deleteObject: true }, baseCtx);
    expect(S3Client.prototype.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
  });

  describe('candidateGlobalImages', () => {
    let svc: ImageModerationService;
    let equipId: number;
    let userId: number;
    beforeAll(() => {
      svc = new ImageModerationService(prisma);
    });
    beforeEach(async () => {
      await cleanDB();
      const user = await prisma.user.create({
        data: { username: 'u', email: 'e@e.com', password: 'pw' },
      });
      userId = user.id;
      const gym = await prisma.gym.create({
        data: {
          name: 'Gym',
          country: 'US',
          city: 'City',
          address: 'Addr',
          creatorId: user.id,
        },
      });
      const cat = await prisma.equipmentCategory.create({
        data: { name: 'Cat', slug: 'cat' },
      });
      const equip = await prisma.equipment.create({
        data: { name: 'Eq', brand: 'B', categoryId: cat.id },
      });
      equipId = equip.id;
      await prisma.equipmentImage.create({
        data: {
          equipmentId: equipId,
          storageKey: `private/global/equipment/${equipId}/approved/eq.jpg`,
          mimeType: 'image/jpeg',
          width: 0,
          height: 0,
          sha256: 'dup',
        },
      });
      await prisma.gymEquipmentImage.createMany({
        data: [
          {
            id: 'img1',
            gymId: gym.id,
            equipmentId: equipId,
            status: 'PENDING',
            storageKey: 'a',
            sha256: 'dup',
          },
          {
            id: 'img2',
            gymId: gym.id,
            equipmentId: equipId,
            status: 'PENDING',
            storageKey: 'b',
            sha256: null,
          },
          {
            id: 'img3',
            gymId: gym.id,
            equipmentId: equipId,
            status: 'APPROVED',
            storageKey: 'c',
            sha256: 'uniq',
            approvedAt: new Date(),
            approvedByUserId: userId,
          },
          {
            id: 'img4',
            gymId: gym.id,
            equipmentId: equipId,
            status: 'REJECTED',
            storageKey: 'd',
            sha256: 'x',
          },
          {
            id: 'img5',
            gymId: gym.id,
            equipmentId: equipId,
            status: 'QUARANTINED',
            storageKey: 'e',
            sha256: 'q',
          },
        ],
      });
    });

    it('excludes promoted and includes null sha', async () => {
      const res = await svc.candidateGlobalImages({ equipmentId: equipId });
      const ids = res.map((r: any) => r.id).sort();
      expect(ids).toEqual(['img2']);
      res.forEach((r: any) => {
        expect(r).toHaveProperty('createdAt');
        expect(r.gymName).toBe('Gym');
        expect(r.dupCount).toBe(0);
        expect(r.safety.state).toBe('PENDING');
        expect(r).toHaveProperty('approvedAt');
        expect(r).toHaveProperty('approvedByUserId');
      });
      const pending = res[0];
      expect(pending.approvedAt).toBeNull();
      expect(pending.approvedByUserId).toBeNull();
    });

    it('includes images with active jobs', async () => {
      const gym = await prisma.gym.findFirstOrThrow();
      await prisma.gymEquipmentImage.create({
        data: {
          id: 'img6',
          gymId: gym.id,
          equipmentId: equipId,
          status: 'APPROVED',
          storageKey: 'job', // unique
          sha256: 'jobsha',
          approvedAt: new Date(),
          approvedByUserId: userId,
        },
      });
      await prisma.imageQueue.create({
        data: { storageKey: 'job', jobType: 'EMBED', status: 'pending' },
      });

      const res = await svc.candidateGlobalImages({ equipmentId: equipId });
      const ids = res.map((r: any) => r.id).sort();
      expect(ids).toEqual(['img2', 'img6']);
    });

    it('filters by status when provided', async () => {
      const res = await svc.candidateGlobalImages({
        equipmentId: equipId,
        status: AdminImageListStatusDto.QUARANTINED,
      });
      const ids = res.map((r: any) => r.id).sort();
      expect(ids).toEqual(['img5']);
    });
  });
});
