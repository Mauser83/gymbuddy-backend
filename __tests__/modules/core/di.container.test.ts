import { DIContainer } from '../../../src/modules/core/di.container';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { UserService } from '../../../src/modules/auth/user.service';
import { SharingService } from '../../../src/modules/workoutplan/workoutplanSharing.service';
import { AuditService } from '../../../src/modules/core/audit.service';
import { prisma } from '../../../src/lib/prisma';

jest.mock('../../../src/lib/prisma', () => {
  const prisma = {};
  return { prisma, PrismaClient: class {} };
});

beforeEach(() => {
  // reset singleton for isolation
  (DIContainer as any).instance = undefined;
});

describe('DIContainer', () => {
  test('getInstance returns singleton', () => {
    const a = DIContainer.getInstance();
    const b = DIContainer.getInstance();
    expect(a).toBe(b);
  });

  test('resolves default singletons with dependencies', () => {
    const container = DIContainer.getInstance();

    const prismaObj = container.resolve('PrismaClient');
    expect(prismaObj).toBe(prisma);

    const perm = container.resolve<PermissionService>('PermissionService');
    expect(perm).toBe(container.resolve('PermissionService'));
    expect((perm as any).prisma).toBe(prisma);

    const audit = container.resolve<AuditService>('AuditService');
    expect((audit as any).prisma).toBe(prisma);

    const user = container.resolve<UserService>('UserService');
    expect((user as any).prisma).toBe(prisma);
    expect((user as any).permissionService).toBe(perm);
    expect((user as any).auditService).toBe(audit);

    const share = container.resolve<SharingService>('SharingService');
    expect((share as any).prisma).toBe(prisma);
    expect((share as any).permissionService).toBe(perm);
  });

  test('registerTransient provides new instance', () => {
    const container = DIContainer.getInstance();
    class Foo {}
    container.registerTransient<Foo>('Foo', () => new Foo());

    const f1 = container.resolve<Foo>('Foo');
    const f2 = container.resolve<Foo>('Foo');
    expect(f1).not.toBe(f2);
  });

  test('throws when resolving unknown service', () => {
    const container = DIContainer.getInstance();
    expect(() => container.resolve('Unknown')).toThrow('Service Unknown not registered');
  });

  test('static resolve delegates to instance', () => {
    const container = DIContainer.getInstance();
    const perm = DIContainer.resolve<PermissionService>('PermissionService');
    expect(perm).toBe(container.resolve('PermissionService'));
  });
});