import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { AuditService, auditLoggingTestUtils } from '../../../src/modules/core/audit.service';
import { PrismaClient } from '../../../src/prisma';

describe('AuditService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: AuditService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new AuditService(prisma);
    auditLoggingTestUtils.disable();
  });

  afterEach(() => {
    auditLoggingTestUtils.disable();
    jest.resetAllMocks();
  });

  describe('logEvent', () => {
    test('returns undefined when logging disabled', async () => {
      const res = await service.logEvent({
        action: 'TEST',
        entity: 'User',
        entityId: 2,
        userId: 3,
        metadata: { foo: 'bar' },
      });

      expect(res).toBeUndefined();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    test('persists audit entry when logging enabled', async () => {
      auditLoggingTestUtils.enable();

      await service.logEvent({
        action: 'TEST',
        entity: 'User',
        entityId: 5,
        userId: 7,
        metadata: 'unexpected metadata',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'TEST',
          entity: 'User',
          entityId: 5,
          userId: 7,
          metadata: {},
        },
      });
    });
  });

  describe('helper methods', () => {
    test('logUserLogin forwards parameters', async () => {
      const spy = jest.spyOn(service, 'logEvent').mockResolvedValue({} as any);
      await service.logUserLogin(1, '1.1.1.1');
      expect(spy).toHaveBeenCalledWith({
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: 1,
        userId: 1,
        metadata: { ipAddress: '1.1.1.1' },
      });
    });

    test('logDataUpdate forwards parameters', async () => {
      const spy = jest.spyOn(service, 'logEvent').mockResolvedValue({} as any);
      await service.logDataUpdate({ userId: 1, entity: 'User', entityId: 2, changes: { a: 1 } });
      expect(spy).toHaveBeenCalledWith({
        action: 'DATA_UPDATE',
        entity: 'User',
        entityId: 2,
        userId: 1,
        metadata: { changes: { a: 1 } },
      });
    });

    test('logDataDeletion forwards parameters', async () => {
      const spy = jest.spyOn(service, 'logEvent').mockResolvedValue({} as any);
      await service.logDataDeletion({ userId: 1, entity: 'User', entityId: 2 });
      expect(spy).toHaveBeenCalledWith({
        action: 'DATA_DELETION',
        entity: 'User',
        entityId: 2,
        userId: 1,
      });
    });

    test('logPermissionChange forwards parameters', async () => {
      const spy = jest.spyOn(service, 'logEvent').mockResolvedValue({} as any);
      await service.logPermissionChange({ userId: 1, targetUserId: 2, changes: { b: 2 } });
      expect(spy).toHaveBeenCalledWith({
        action: 'PERMISSION_CHANGE',
        entity: 'User',
        entityId: 2,
        userId: 1,
        metadata: { changes: { b: 2 } },
      });
    });

    test('logDataUpdate converts non-object changes to empty metadata when enabled', async () => {
      auditLoggingTestUtils.enable();

      await service.logDataUpdate({
        userId: 11,
        entity: 'User',
        entityId: 22,
        changes: ['unexpected', 'array'] as unknown as Record<string, unknown>,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'DATA_UPDATE',
          entity: 'User',
          entityId: 22,
          userId: 11,
          metadata: { changes: {} },
        },
      });
    });
  });
});
