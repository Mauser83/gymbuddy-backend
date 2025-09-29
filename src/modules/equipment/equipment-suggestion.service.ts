import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GraphQLError } from 'graphql';

import {
  ApproveEquipmentSuggestionDto,
  CreateEquipmentSuggestionDto,
  CreateEquipmentSuggestionUploadTicketDto,
  EquipmentSuggestionStatusDto,
  FinalizeEquipmentSuggestionImagesDto,
  ListEquipmentSuggestionsDto,
  RejectEquipmentSuggestionDto,
} from './equipment.dto';
import type {
  ApproveEquipmentSuggestionInput,
  CreateEquipmentSuggestionInput,
  CreateEquipmentSuggestionPayload,
  EquipmentSuggestionConnection,
  EquipmentSuggestionUploadTicketInput,
  FinalizeEquipmentSuggestionImagesInput,
  ListEquipmentSuggestionsInput,
  RejectEquipmentSuggestionInput,
} from './equipment.types';
import { validateInput } from '../../middlewares/validation';
import type { PrismaClient } from '../../prisma';
import { fileExtFrom } from '../../utils/makeKey';
import { verifyGymScope, verifyRoles } from '../auth/auth.roles';
import type { AuthContext } from '../auth/auth.types';
import type { PermissionService } from '../core/permission.service';
import { copyObjectIfMissing } from '../media/media.service';
import { assertSizeWithinLimit } from '../media/media.utils';

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

function ensureAuthenticated(context: AuthContext) {
  if (!context.userId) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

function parseSuggestionSha(storageKey: string) {
  const leaf = storageKey.split('/').pop() ?? '';
  const [sha] = leaf.split('.');
  if (!sha) return null;
  return sha;
}

export class EquipmentSuggestionService {
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

  async createSuggestion(
    input: CreateEquipmentSuggestionInput,
    context: AuthContext,
  ): Promise<CreateEquipmentSuggestionPayload> {
    ensureAuthenticated(context);
    const dto = Object.assign(new CreateEquipmentSuggestionDto(), input);
    await validateInput(dto, CreateEquipmentSuggestionDto);

    if (dto.gymId) {
      verifyGymScope(context, this.permissionService, dto.gymId);
    }

    const suggestion = await this.prisma.equipmentSuggestion.create({
      data: {
        gymId: dto.gymId ?? null,
        managerUserId: context.userId!,
        name: dto.name,
        description: dto.description ?? null,
        brand: dto.brand,
        manualUrl: dto.manualUrl ?? null,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId ?? null,
        addToGymOnApprove: dto.addToGymOnApprove ?? true,
      },
      include: { images: true },
    });

    const searchClauses = [] as any[];
    if (dto.name) {
      searchClauses.push({ name: { contains: dto.name, mode: 'insensitive' } });
    }
    if (dto.brand) {
      searchClauses.push({ brand: { contains: dto.brand, mode: 'insensitive' } });
    }

    const nearMatches = searchClauses.length
      ? await this.prisma.equipment.findMany({
          where: {
            AND: [
              { categoryId: dto.categoryId },
              dto.subcategoryId ? { subcategoryId: dto.subcategoryId } : {},
              { OR: searchClauses },
            ],
          },
          take: 5,
        })
      : [];

    return { suggestion, nearMatches };
  }

  async listSuggestions(
    input: ListEquipmentSuggestionsInput,
    context: AuthContext,
  ): Promise<EquipmentSuggestionConnection> {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    const dto = Object.assign(new ListEquipmentSuggestionsDto(), input);
    await validateInput(dto, ListEquipmentSuggestionsDto);

    const take = Math.min(dto.limit ?? 50, 100);
    const rows = await this.prisma.equipmentSuggestion.findMany({
      where: {
        status: dto.status,
        ...(dto.gymId ? { gymId: dto.gymId } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.subcategoryId ? { subcategoryId: dto.subcategoryId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: { images: true },
    });

    const items = rows.slice(0, take);
    const nextCursor = rows.length > take ? rows[take].id : null;
    return { items, nextCursor: nextCursor ?? null };
  }

  async createUploadTicket(input: EquipmentSuggestionUploadTicketInput, context: AuthContext) {
    ensureAuthenticated(context);
    const dto = Object.assign(new CreateEquipmentSuggestionUploadTicketDto(), input);
    await validateInput(dto, CreateEquipmentSuggestionUploadTicketDto);

    const suggestion = await this.prisma.equipmentSuggestion.findUnique({
      where: { id: dto.suggestionId },
      select: { managerUserId: true, status: true },
    });
    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== EquipmentSuggestionStatusDto.PENDING) {
      throw new Error('Suggestion is not pending');
    }
    if (
      context.appRole !== 'ADMIN' &&
      context.appRole !== 'MODERATOR' &&
      suggestion.managerUserId !== context.userId
    ) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const { upload } = dto;
    assertSizeWithinLimit(upload.contentLength);
    const ext = upload.ext.trim().toLowerCase();
    if (!EXT_WHITELIST.has(ext)) throw new Error('Unsupported image extension');

    const sha = upload.sha256?.trim();
    if (!sha) throw new Error('sha256 is required');

    const storageKey = `private/suggestions/candidates/${dto.suggestionId}/${sha}.${ext}`;
    const contentType = upload.contentType || inferContentType(ext);

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ContentType: contentType,
    });
    const putUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 600 });
    return { putUrl, storageKey };
  }

  async finalizeImages(input: FinalizeEquipmentSuggestionImagesInput, context: AuthContext) {
    ensureAuthenticated(context);
    const dto = Object.assign(new FinalizeEquipmentSuggestionImagesDto(), input);
    await validateInput(dto, FinalizeEquipmentSuggestionImagesDto);

    const suggestion = await this.prisma.equipmentSuggestion.findUnique({
      where: { id: dto.suggestionId },
      select: { managerUserId: true, status: true },
    });
    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== EquipmentSuggestionStatusDto.PENDING) {
      throw new Error('Suggestion is not pending');
    }
    if (
      context.appRole !== 'ADMIN' &&
      context.appRole !== 'MODERATOR' &&
      suggestion.managerUserId !== context.userId
    ) {
      throw new GraphQLError('Insufficient permissions', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const prefix = `private/suggestions/candidates/${dto.suggestionId}/`;
    const results = [];
    for (const storageKey of dto.storageKeys) {
      if (!storageKey.startsWith(prefix)) {
        throw new Error('Storage key does not belong to suggestion');
      }
      const sha = parseSuggestionSha(storageKey);
      if (!sha) throw new Error('Invalid storage key');

      const head = await this.s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }));
      const contentLength = Number(head.ContentLength ?? 0);

      const row = await this.prisma.equipmentSuggestionImage.upsert({
        where: { storageKey },
        update: { contentLength, sha256: sha },
        create: {
          suggestionId: dto.suggestionId,
          storageKey,
          sha256: sha,
          contentLength,
        },
      });
      results.push(row);
    }

    return results;
  }

  async approve(input: ApproveEquipmentSuggestionInput, context: AuthContext) {
    const dto = Object.assign(new ApproveEquipmentSuggestionDto(), input);
    await validateInput(dto, ApproveEquipmentSuggestionDto);
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    const suggestion = await this.prisma.equipmentSuggestion.findUnique({
      where: { id: dto.id },
      include: { images: true },
    });
    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== EquipmentSuggestionStatusDto.PENDING) {
      throw new Error('Suggestion is not pending');
    }

    let equipmentId = dto.mergeIntoEquipmentId ?? null;
    if (equipmentId) {
      const exists = await this.prisma.equipment.findUnique({ where: { id: equipmentId } });
      if (!exists) throw new Error('Equipment to merge not found');
    } else {
      const created = await this.prisma.equipment.create({
        data: {
          name: suggestion.name,
          description: suggestion.description,
          brand: suggestion.brand,
          manualUrl: suggestion.manualUrl,
          categoryId: suggestion.categoryId,
          subcategoryId: suggestion.subcategoryId ?? null,
        },
      });
      equipmentId = created.id;
    }

    let gymEquipmentId: number | null = null;
    if (suggestion.gymId && suggestion.addToGymOnApprove) {
      const join = await this.prisma.gymEquipment.upsert({
        where: {
          gymId_equipmentId: {
            gymId: suggestion.gymId,
            equipmentId,
          },
        },
        update: {},
        create: {
          gymId: suggestion.gymId,
          equipmentId,
          quantity: 1,
        },
      });
      gymEquipmentId = join.id;
    }

    for (const image of suggestion.images) {
      const sha = image.sha256;
      if (!sha) continue;
      const ext = fileExtFrom(image.storageKey);
      const dstKey = `private/global/candidates/${equipmentId}/${sha}.${ext}`;
      await copyObjectIfMissing(image.storageKey, dstKey);

      let gymImageId: string | null = null;
      if (suggestion.gymId) {
        const gymImage = await this.prisma.gymEquipmentImage.upsert({
          where: { sha256: sha },
          update: {
            storageKey: dstKey,
            equipmentId,
            gymId: suggestion.gymId,
            gymEquipmentId: gymEquipmentId,
          },
          create: {
            gymEquipmentId: gymEquipmentId,
            gymId: suggestion.gymId,
            equipmentId,
            storageKey: dstKey,
            status: 'PENDING',
            candidateForGlobal: true,
            capturedAt: new Date(),
            capturedByUserId: suggestion.managerUserId,
            sha256: sha,
          },
        });
        gymImageId = gymImage.id;
      }

      if (gymImageId) {
        await this.prisma.globalImageSuggestion.upsert({
          where: { sha256: sha },
          update: {
            equipmentId,
            gymImageId,
            storageKey: dstKey,
            status: 'PENDING',
            reasonCodes: { set: ['MANAGER_SUGGESTION'] },
            usefulnessScore: 0.5,
          },
          create: {
            equipmentId,
            gymImageId,
            storageKey: dstKey,
            sha256: sha,
            usefulnessScore: 0.5,
            reasonCodes: ['MANAGER_SUGGESTION'],
          },
        });
      }
    }

    await this.prisma.equipmentSuggestion.update({
      where: { id: dto.id },
      data: {
        status: EquipmentSuggestionStatusDto.APPROVED,
        approvedEquipmentId: equipmentId,
      },
    });

    return { approved: true, equipmentId };
  }

  async reject(input: RejectEquipmentSuggestionInput, context: AuthContext) {
    const dto = Object.assign(new RejectEquipmentSuggestionDto(), input);
    await validateInput(dto, RejectEquipmentSuggestionDto);
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    await this.prisma.equipmentSuggestion.update({
      where: { id: dto.id },
      data: {
        status: EquipmentSuggestionStatusDto.REJECTED,
        rejectedReason: dto.reason ?? null,
      },
    });

    return { rejected: true };
  }
}
