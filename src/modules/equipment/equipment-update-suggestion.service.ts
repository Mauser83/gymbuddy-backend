import { GraphQLError } from 'graphql';

import {
  ApproveEquipmentUpdateSuggestionDto,
  CreateEquipmentUpdateSuggestionDto,
  ListEquipmentUpdateSuggestionsDto,
  RejectEquipmentUpdateSuggestionDto,
} from './equipment.dto';
import type {
  ApproveEquipmentUpdateSuggestionInput,
  ApproveEquipmentUpdateSuggestionPayload,
  CreateEquipmentUpdateSuggestionInput,
  CreateEquipmentUpdateSuggestionPayload,
  EquipmentUpdateSuggestionConnection,
  ListEquipmentUpdateSuggestionsInput,
  RejectEquipmentUpdateSuggestionInput,
  RejectEquipmentUpdateSuggestionPayload,
} from './equipment.types';
import { validateInput } from '../../middlewares/validation';
import type { PrismaClient } from '../../prisma';
import { verifyRoles } from '../auth/auth.roles';
import type { AuthContext } from '../auth/auth.types';

function ensureAuthenticated(context: AuthContext) {
  if (!context.userId) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

export class EquipmentUpdateSuggestionService {
  constructor(private prisma: PrismaClient) {}

  async listSuggestions(
    input: ListEquipmentUpdateSuggestionsInput,
    context: AuthContext,
  ): Promise<EquipmentUpdateSuggestionConnection> {
    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    const dto = Object.assign(new ListEquipmentUpdateSuggestionsDto(), input);
    await validateInput(dto, ListEquipmentUpdateSuggestionsDto);

    const take = Math.min(dto.limit ?? 25, 100);
    const status = dto.status ?? 'PENDING';

    const rows = await this.prisma.equipmentUpdateSuggestion.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: { equipment: true },
    });

    const items = rows.slice(0, take);
    const nextCursor = rows.length > take ? rows[take].id : null;

    return { items, nextCursor: nextCursor ?? null };
  }

  async create(
    input: CreateEquipmentUpdateSuggestionInput,
    context: AuthContext,
  ): Promise<CreateEquipmentUpdateSuggestionPayload> {
    ensureAuthenticated(context);
    const dto = Object.assign(new CreateEquipmentUpdateSuggestionDto(), input);
    await validateInput(dto, CreateEquipmentUpdateSuggestionDto);

    const equipment = await this.prisma.equipment.findUnique({
      where: { id: dto.equipmentId },
      select: { id: true },
    });
    if (!equipment) {
      throw new Error('Equipment not found');
    }

    const suggestion = await this.prisma.equipmentUpdateSuggestion.create({
      data: {
        equipmentId: dto.equipmentId,
        proposedName: dto.proposedName,
        proposedBrand: dto.proposedBrand,
        proposedManualUrl: dto.proposedManualUrl ?? null,
        submittedByUserId: context.userId!,
        status: 'PENDING',
      },
    });

    return { suggestion };
  }

  async approve(
    input: ApproveEquipmentUpdateSuggestionInput,
    context: AuthContext,
  ): Promise<ApproveEquipmentUpdateSuggestionPayload> {
    ensureAuthenticated(context);
    const dto = Object.assign(new ApproveEquipmentUpdateSuggestionDto(), input);
    await validateInput(dto, ApproveEquipmentUpdateSuggestionDto);

    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    const suggestion = await this.prisma.equipmentUpdateSuggestion.findUnique({
      where: { id: dto.id },
    });
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not pending');
    }

    await this.prisma.$transaction([
      this.prisma.equipment.update({
        where: { id: suggestion.equipmentId },
        data: {
          name: suggestion.proposedName,
          brand: suggestion.proposedBrand,
          manualUrl: suggestion.proposedManualUrl ?? null,
        },
      }),
      this.prisma.equipmentUpdateSuggestion.update({
        where: { id: dto.id },
        data: {
          status: 'APPROVED',
          approvedByUserId: context.userId!,
          approvedAt: new Date(),
        },
      }),
    ]);

    return { approved: true, equipmentId: suggestion.equipmentId };
  }

  async reject(
    input: RejectEquipmentUpdateSuggestionInput,
    context: AuthContext,
  ): Promise<RejectEquipmentUpdateSuggestionPayload> {
    ensureAuthenticated(context);
    const dto = Object.assign(new RejectEquipmentUpdateSuggestionDto(), input);
    await validateInput(dto, RejectEquipmentUpdateSuggestionDto);

    verifyRoles(context, {
      or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
    });

    const suggestion = await this.prisma.equipmentUpdateSuggestion.findUnique({
      where: { id: dto.id },
      select: { status: true },
    });
    if (!suggestion) {
      throw new Error('Suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion is not pending');
    }

    await this.prisma.equipmentUpdateSuggestion.update({
      where: { id: dto.id },
      data: {
        status: 'REJECTED',
        rejectedReason: dto.reason ?? null,
      },
    });

    return { rejected: true };
  }
}
