import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import {
  CreateGymDto,
  AssignEquipmentToGymDto,
  UpdateGymDto,
  UploadGymImageDto,
  UpdateGymEquipmentDto,
} from './gym.dto';
import { CreateGymInput, UpdateGymInput } from './gym.types';
import { ImageJobStatus } from '../../generated/prisma';
import { pubsub } from '../../graphql/rootResolvers';
import { PrismaClient } from '../../lib/prisma';
import { validateInput } from '../../middlewares/validation';
import { makeKey } from '../../utils/makeKey';
import { PermissionType } from '../auth/auth.types';
import { PermissionService } from '../core/permission.service';
import { kickBurstRunner } from '../images/image-worker';
import { priorityFromSource } from '../images/queue.service';
import { copyObjectIfMissing, deleteObjectIgnoreMissing } from '../media/media.service';
import type { UploadTicketInput } from '../media/media.types';
import { assertSizeWithinLimit } from '../media/media.utils';

const fullGymInclude = {
  creator: true,
  gymRoles: { include: { user: true } },
  gymEquipment: { include: { equipment: true, images: true } },
  trainers: { include: { user: true } },
};

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const EXT_WHITELIST = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);

function inferContentType(ext: string) {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export class GymService {
  private prisma: PrismaClient;
  private permissionService: PermissionService;
  private s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  constructor(prisma: PrismaClient, permissionService: PermissionService) {
    this.prisma = prisma;
    this.permissionService = permissionService;
  }

  private async checkGymPermission(
    userId: number,
    gymId: number,
    requiredRoles?: ('GYM_ADMIN' | 'GYM_MODERATOR')[],
  ) {
    const userRoles = await this.permissionService.getUserRoles(userId);
    return this.permissionService.checkPermission({
      permissionType: PermissionType.GYM_SCOPE,
      userId: userId,
      userRoles,
      resource: { gymId: gymId },
      requiredRoles: {
        gymRoles: requiredRoles || ['GYM_ADMIN', 'GYM_MODERATOR'],
      },
    });
  }

  async createGym(userId: number, data: CreateGymInput) {
    try {
      await validateInput(data, CreateGymDto);

      const newGym = await this.prisma.gym.create({
        data: {
          ...data,
          isApproved: false,
          creatorId: userId,
        },
      });

      const existing = await this.prisma.gymManagementRole.findFirst({
        where: {
          gymId: newGym.id,
          userId,
          role: 'GYM_ADMIN',
        },
      });

      if (!existing) {
        await this.prisma.gymManagementRole.create({
          data: {
            gymId: newGym.id,
            userId,
            role: 'GYM_ADMIN',
          },
        });
      }

      const gymWithRelations = await this.prisma.gym.findUnique({
        where: { id: newGym.id },
        include: fullGymInclude,
      });

      pubsub.publish('GYM_CREATED', { gymCreated: gymWithRelations });

      return gymWithRelations;
    } catch (err) {
      console.error('❌ createGym crashed', err);
      throw err;
    }
  }

  async getGyms(userId?: number, search?: string) {
    if (!userId) {
      throw new Error('Unauthorized');
    }
    const whereClause: any = { isApproved: true };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.gym.findMany({ where: whereClause });
  }

  async getGymById(gymId: number, userId: number, appRole?: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        gymRoles: {
          where: { userId },
        },
      },
    });

    if (!gym) throw new Error('Gym not found');

    const isAppAdmin = appRole === 'ADMIN' || appRole === 'MODERATOR';

    if (!gym.isApproved && !isAppAdmin) {
      const isGymAdmin = gym.gymRoles.some((r) => r.role === 'GYM_ADMIN');
      if (!isGymAdmin) {
        throw new Error('Unauthorized');
      }
    }

    return gym;
  }

  async getPendingGyms(userId: number) {
    const roles = await this.permissionService.getUserRoles(userId);
    const isAllowed = this.permissionService.verifyAppRoles(roles.appRoles, ['ADMIN', 'MODERATOR']);
    if (!isAllowed) throw new Error('Forbidden');

    return this.prisma.gym.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: 'desc' },
      include: { creator: true },
    });
  }

  async approveGym(userId: number, gymId: number) {
    const roles = await this.permissionService.getUserRoles(userId);
    const isAllowed = this.permissionService.verifyAppRoles(roles.appRoles, ['ADMIN', 'MODERATOR']);
    if (!isAllowed) throw new Error('Forbidden');

    const gym = await this.prisma.gym.update({
      where: { id: gymId },
      data: { isApproved: true },
    });

    const updated = await this.prisma.gym.findUnique({
      where: { id: gym.id },
      include: fullGymInclude,
    });

    pubsub.publish('GYM_APPROVED', { gymApproved: updated });
    return 'Gym approved successfully';
  }

  async updateGym(userId: number, gymId: number, data: UpdateGymInput, appRole?: string) {
    if (appRole !== 'ADMIN') {
      const hasAccess = await this.checkGymPermission(userId, gymId, ['GYM_ADMIN']);
      if (!hasAccess) throw new Error('Insufficient gym permissions');
    }

    return this.prisma.gym.update({
      where: { id: gymId },
      data,
    });
  }

  async deleteGym(userId: number, gymId: number, appRole?: string) {
    if (appRole !== 'ADMIN') {
      const hasAccess = await this.checkGymPermission(userId, gymId, ['GYM_ADMIN']);
      if (!hasAccess) throw new Error('Unauthorized');
    }

    await this.prisma.gym.delete({ where: { id: gymId } });
    return 'Gym deleted successfully';
  }

  async addTrainer(requesterId: number, gymId: number, targetUserId: number) {
    const hasAccess = await this.checkGymPermission(requesterId, gymId, ['GYM_ADMIN']);
    if (!hasAccess) throw new Error('Unauthorized');

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { userRole: true },
    });

    if (user?.userRole !== 'PERSONAL_TRAINER') {
      throw new Error('Target user must be a personal trainer');
    }

    await this.prisma.gymTrainer.create({
      data: { userId: targetUserId, gymId },
    });

    return 'Trainer added successfully';
  }

  async removeTrainer(requesterId: number, gymId: number, targetUserId: number) {
    if (requesterId !== targetUserId) {
      const hasAccess = await this.checkGymPermission(requesterId, gymId, ['GYM_ADMIN']);
      if (!hasAccess) throw new Error('Unauthorized');
    }

    await this.prisma.gymTrainer.delete({
      where: {
        userId_gymId: {
          userId: targetUserId,
          gymId,
        },
      },
    });

    return 'Trainer removed successfully';
  }

  async assignEquipmentToGym(input: AssignEquipmentToGymDto) {
    await validateInput(input, AssignEquipmentToGymDto);

    const exists = await this.prisma.gymEquipment.findFirst({
      where: {
        gymId: input.gymId,
        equipmentId: input.equipmentId,
      },
    });

    if (exists) {
      throw new Error('This equipment is already assigned to this gym');
    }

    return this.prisma.gymEquipment.create({
      data: {
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        quantity: input.quantity,
        note: input.note,
      },
      include: { equipment: true, images: true },
    });
  }

  async updateGymEquipment(input: UpdateGymEquipmentDto) {
    await validateInput(input, UpdateGymEquipmentDto);

    return this.prisma.gymEquipment.update({
      where: { id: input.gymEquipmentId },
      data: {
        quantity: input.quantity,
        note: input.note,
      },
      include: { equipment: true, images: true },
    });
  }

  async removeGymEquipment(gymEquipmentId: number) {
    await this.prisma.gymEquipmentImage.deleteMany({
      where: { gymEquipmentId },
    });

    await this.prisma.gymEquipment.delete({
      where: { id: gymEquipmentId },
    });

    return true;
  }

  async uploadGymImage(input: UploadGymImageDto) {
    await validateInput(input, UploadGymImageDto);

    const gymEquipment = await this.prisma.gymEquipment.findFirst({
      where: { gymId: input.gymId, equipmentId: input.equipmentId },
      select: { id: true },
    });
    if (!gymEquipment) throw new Error('Equipment not assigned to this gym');

    const equipmentImage = await this.prisma.equipmentImage.create({
      data: {
        equipmentId: input.equipmentId,
        storageKey: input.storageKey,
        sha256: input.sha256,
      } as any,
    });

    return this.prisma.gymEquipmentImage.create({
      data: {
        gymEquipmentId: gymEquipment.id,
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        imageId: equipmentImage.id,
        status: input.status ?? undefined,
      },
    });
  }

  async deleteGymImage(userId: number, imageId: string) {
    const img = await this.prisma.gymEquipmentImage.findUnique({
      where: { id: imageId },
      select: { gymId: true, gymEquipmentId: true, isPrimary: true },
    });
    if (!img) throw new Error('Image not found');

    const hasAccess = await this.checkGymPermission(userId, img.gymId);
    if (!hasAccess) throw new Error('Unauthorized');

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.gymEquipmentImage.delete({
        where: { id: imageId },
      });
      if (deleted.isPrimary && deleted.gymEquipmentId) {
        const next = await tx.gymEquipmentImage.findFirst({
          where: { gymEquipmentId: deleted.gymEquipmentId },
          orderBy: { capturedAt: 'desc' },
        });
        if (next) {
          await tx.gymEquipmentImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    return true;
  }

  async setPrimaryGymEquipmentImage(userId: number, imageId: string) {
    const img = await this.prisma.gymEquipmentImage.findUnique({
      where: { id: imageId },
      select: { gymId: true, gymEquipmentId: true },
    });
    if (!img || !img.gymEquipmentId) throw new Error('Image not found');

    const hasAccess = await this.checkGymPermission(userId, img.gymId);
    if (!hasAccess) throw new Error('Unauthorized');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.gymEquipmentImage.updateMany({
        where: { gymEquipmentId: img.gymEquipmentId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.gymEquipmentImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });

    return updated;
  }

  async getGymImagesByGymId(gymId: number) {
    return this.prisma.gymEquipmentImage.findMany({
      where: { gymId },
      orderBy: { capturedAt: 'desc' },
      include: { image: true },
    });
  }

  async getGymImageById(id: string) {
    return this.prisma.gymEquipmentImage.findUnique({
      where: { id },
      include: { image: true },
    });
  }

  async getGymEquipment(gymId: number) {
    return this.prisma.gymEquipment.findMany({
      where: { gymId },
      include: { equipment: true, images: true },
    });
  }

  async getGymEquipmentDetail(gymEquipmentId: number) {
    return this.prisma.gymEquipment.findUnique({
      where: { id: gymEquipmentId },
      include: {
        gym: true, // ✅ ensure gym is always loaded
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
  }

  async listGymEquipmentImages(
    userId: number,
    gymEquipmentId: number,
    limit = 24,
    cursor?: string,
  ) {
    const join = await this.prisma.gymEquipment.findUnique({
      where: { id: gymEquipmentId },
      select: { gymId: true },
    });
    if (!join) throw new Error('Gym equipment not found');

    const hasAccess = await this.checkGymPermission(userId, join.gymId);
    if (!hasAccess) throw new Error('Unauthorized');

    const rows = await this.prisma.gymEquipmentImage.findMany({
      where: { gymEquipmentId },
      take: limit + 1,
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? rows[rows.length - 1].id : null;
    return { items, nextCursor };
  }

  async createAdminUploadTicket(params: {
    gymId: number;
    upload: UploadTicketInput;
    ttlSec: number;
    requestedByUserId: number;
  }) {
    assertSizeWithinLimit(params.upload.contentLength);
    const ext = params.upload.ext.trim().toLowerCase();
    if (!EXT_WHITELIST.has(ext)) throw new Error('Unsupported image extension');

    const storageKey = makeKey(
      'upload',
      { gymId: params.gymId },
      { ext: ext as 'jpg' | 'png' | 'webp' },
    );
    const contentType = params.upload.contentType || inferContentType(ext);
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: params.ttlSec });
    const expiresAt = new Date(Date.now() + params.ttlSec * 1000).toISOString();
    return {
      url,
      storageKey,
      expiresAt,
      requiredHeaders: [{ name: 'Content-Type', value: contentType }],
    };
  }

  async createEquipmentTrainingUploadTicket(
    userId: number,
    gymId: number,
    equipmentId: number,
    upload: UploadTicketInput,
  ) {
    const hasAccess = await this.checkGymPermission(userId, gymId);
    if (!hasAccess) throw new Error('Unauthorized');

    assertSizeWithinLimit(upload.contentLength);
    const ext = upload.ext.trim().toLowerCase();
    if (!EXT_WHITELIST.has(ext)) throw new Error('Unsupported image extension');

    const storageKey = `private/uploads/gym/${equipmentId}/${randomUUID()}.${ext}`;
    const contentType = upload.contentType || inferContentType(ext);
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ContentType: contentType,
    });
    const putUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 600 });
    return { putUrl, storageKey };
  }

  async finalizeEquipmentTrainingImage(userId: number, gymEquipmentId: number, storageKey: string) {
    const join = await this.prisma.gymEquipment.findUnique({
      where: { id: gymEquipmentId },
      select: { gymId: true, equipmentId: true },
    });
    if (!join) throw new Error('Gym equipment not found');

    const hasAccess = await this.checkGymPermission(userId, join.gymId);
    if (!hasAccess) throw new Error('Unauthorized');

    const parts = storageKey.split('/');
    const filename = parts[parts.length - 1] || '';
    const [uuidPart, extRaw] = filename.split('.');
    const ext = (extRaw || 'jpg').toLowerCase();
    const objectUuid = uuidPart;

    const approvedKey = `private/gym/${gymEquipmentId}/approved/${randomUUID()}.${ext}`;

    await copyObjectIfMissing(storageKey, approvedKey);
    await deleteObjectIgnoreMissing(storageKey);

    const image = await this.prisma.gymEquipmentImage.create({
      data: {
        gymEquipmentId,
        gymId: join.gymId,
        equipmentId: join.equipmentId,
        storageKey: approvedKey,
        status: 'PENDING',
        capturedAt: new Date(),
        objectUuid,
        capturedByUserId: userId,
      },
    });

    await this.prisma.trainingCandidate.create({
      data: {
        storageKey: approvedKey,
        imageId: image.id,
        gymEquipmentId,
        gymId: join.gymId,
        uploaderUserId: userId,
        source: 'gym_equipment',
        status: 'pending',
      },
    });

    const source = 'gym_equipment' as const;
    const priority = priorityFromSource(source);

    await this.prisma.imageQueue.create({
      data: {
        jobType: 'HASH',
        status: ImageJobStatus.pending,
        priority,
        storageKey: approvedKey,
      },
    });

    setImmediate(() => {
      kickBurstRunner().catch((e) => console.error('burst runner error', e));
    });

    return image;
  }

  async getImageProcessingStatus(imageId: string) {
    const img = await this.prisma.gymEquipmentImage.findUnique({
      where: { id: imageId },
      select: { status: true, storageKey: true },
    });
    if (!img) throw new Error('Image not found');
    const job = await this.prisma.imageQueue.findFirst({
      where: { storageKey: img.storageKey, status: ImageJobStatus.pending },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) {
      return {
        status: img.status,
        queuePosition: 0,
        etaSeconds: 0,
        attempts: 0,
        scheduledAt: null,
        priority: 0,
      };
    }
    const rows = await this.prisma.$queryRaw<{ totalahead: bigint }[]>`
      SELECT COUNT(*)::bigint as totalahead
      FROM "ImageQueue"
      WHERE status = 'pending'
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
        AND (priority > ${job.priority}
          OR (priority = ${job.priority} AND "createdAt" < ${job.createdAt}))
    `;
    const totalAhead = Number(rows?.[0]?.totalahead ?? 0);
    const throughput = Number(process.env.THROUGHPUT_JOBS_PER_MIN ?? 20);
    const etaSeconds = Math.ceil((totalAhead * 60) / Math.max(throughput, 1));
    return {
      status: img.status,
      queuePosition: totalAhead,
      etaSeconds,
      attempts: job.attempts,
      scheduledAt: job.scheduledAt?.toISOString?.() ?? null,
      priority: job.priority,
    };
  }
}
