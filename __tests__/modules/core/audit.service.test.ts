import { AuditService } from '../../../src/modules/core/audit.service';
import { PrismaClient } from '../../../src/generated/prisma';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('AuditService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: AuditService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new AuditService(prisma);
  });

  describe('logEvent', () => {
    test('creates audit log with object metadata', async () => {
      const result = { id: 1 } as any;
      prisma.auditLog.create.mockResolvedValue(result);

      const res = await service.logEvent({
        action: 'TEST',
        entity: 'User',
        entityId: 2,
        userId: 3,
        metadata: { foo: 'bar' }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'TEST',
          entity: 'User',
          entityId: 2,
          userId: 3,
          metadata: { foo: 'bar' }
        }
      });
      expect(res).toBe(result);
    });

    test('replaces non-object metadata with empty object', async () => {
      prisma.auditLog.create.mockResolvedValue({} as any);

      await service.logEvent({ action: 'TEST', metadata: 'bad' as any });
      expect(prisma.auditLog.create).toHaveBeenLastCalledWith({
        data: { action: 'TEST', entity: undefined, entityId: undefined, userId: undefined, metadata: {} }
      });

      await service.logEvent({ action: 'TEST2', metadata: [1, 2] as any });
      expect(prisma.auditLog.create).toHaveBeenLastCalledWith({
        data: { action: 'TEST2', entity: undefined, entityId: undefined, userId: undefined, metadata: {} }
      });

      await service.logEvent({ action: 'TEST3', metadata: null as any });
      expect(prisma.auditLog.create).toHaveBeenLastCalledWith({
        data: { action: 'TEST3', entity: undefined, entityId: undefined, userId: undefined, metadata: undefined }
      });
    });

    test('omits metadata when undefined', async () => {
      prisma.auditLog.create.mockResolvedValue({} as any);
      await service.logEvent({ action: 'TEST' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { action: 'TEST', entity: undefined, entityId: undefined, userId: undefined, metadata: undefined }
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
        metadata: { ipAddress: '1.1.1.1' }
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
        metadata: { changes: { a: 1 } }
      });
    });

    test('logDataDeletion forwards parameters', async () => {
      const spy = jest.spyOn(service, 'logEvent').mockResolvedValue({} as any);
      await service.logDataDeletion({ userId: 1, entity: 'User', entityId: 2 });
      expect(spy).toHaveBeenCalledWith({
        action: 'DATA_DELETION',
        entity: 'User',
        entityId: 2,
        userId: 1
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
        metadata: { changes: { b: 2 } }
      });
    });
  });
});