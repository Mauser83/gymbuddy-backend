import { PrismaClient } from '../../prisma';
import type { JsonObject } from '../../prisma';

// Toggle to enable/disable audit logging
const AUDIT_LOGGING_ENABLED = false;

function toJsonObject(data: unknown): JsonObject {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return data as JsonObject;
  }
  return {};
}

export class AuditService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async logEvent(params: {
    action: string;
    entity?: string;
    entityId?: number;
    userId?: number;
    metadata?: unknown;
  }): Promise<void> {
    if (!AUDIT_LOGGING_ENABLED) {
      // Logging disabled; exit early
      return;
    }
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        userId: params.userId,
        metadata: params.metadata ? toJsonObject(params.metadata) : undefined,
      },
    });
  }

  // Common event types
  async logUserLogin(userId: number, ipAddress: string) {
    return this.logEvent({
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: userId,
      userId,
      metadata: { ipAddress },
    });
  }

  async logDataUpdate(params: {
    userId: number;
    entity: string;
    entityId: number;
    changes: Record<string, unknown>;
  }) {
    return this.logEvent({
      action: 'DATA_UPDATE',
      entity: params.entity,
      entityId: params.entityId,
      userId: params.userId,
      metadata: { changes: toJsonObject(params.changes) },
    });
  }

  async logDataDeletion(params: { userId: number; entity: string; entityId: number }) {
    return this.logEvent({
      action: 'DATA_DELETION',
      entity: params.entity,
      entityId: params.entityId,
      userId: params.userId,
    });
  }

  async logPermissionChange(params: {
    userId: number;
    targetUserId: number;
    changes: Record<string, unknown>;
  }) {
    return this.logEvent({
      action: 'PERMISSION_CHANGE',
      entity: 'User',
      entityId: params.targetUserId,
      userId: params.userId,
      metadata: { changes: toJsonObject(params.changes) },
    });
  }
}
