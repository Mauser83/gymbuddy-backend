import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaClient } from '../../../src/generated/prisma';
import { AuditService } from '../../../src/modules/core/audit.service';

describe('AuditService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: AuditService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new AuditService(prisma);
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
  });
});
