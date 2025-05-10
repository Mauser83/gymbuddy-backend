import { prisma, PrismaClient } from '../../lib/prisma';
import { PermissionService } from '../core/permission.service';
import { SharingService } from '../workout/workoutSharing.service';
import { UserService } from '../auth/user.service';
import { AuditService } from '../core/audit.service';

type ServiceConstructor<T> = new (...args: any[]) => T;

interface ServiceRegistration {
  factory: (...args: any[]) => any;
  isSingleton: boolean;
}

export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, ServiceRegistration> = new Map();
  private instances: Map<string, any> = new Map();

  private constructor() {
    this.registerDefaultServices();
  }

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  private registerDefaultServices() {
    // Register core services
    this.registerSingleton<PrismaClient>('PrismaClient', () => prisma);
    
    // Register application services with their dependencies
    this.registerSingleton<PermissionService>('PermissionService', (container) => {
      const prisma = container.resolve<PrismaClient>('PrismaClient');
      return new PermissionService(prisma);
    });

    this.registerSingleton<UserService>('UserService', (container) => {
      const prisma = container.resolve<PrismaClient>('PrismaClient');
      const permissionService = container.resolve<PermissionService>('PermissionService');
      const auditService = container.resolve<AuditService>('AuditService');
      return new UserService(prisma, permissionService, auditService);
    });

    this.registerSingleton<SharingService>('SharingService', (container) => {
      const prisma = container.resolve<PrismaClient>('PrismaClient');
      const permissionService = container.resolve<PermissionService>('PermissionService');
      return new SharingService(prisma, permissionService);
    });

    this.registerSingleton<AuditService>('AuditService', (container) => {
      const prisma = container.resolve<PrismaClient>('PrismaClient');
      return new AuditService(prisma);
    });
  }

  public registerSingleton<T>(key: string, factory: (container: DIContainer) => T) {
    this.services.set(key, {
      factory,
      isSingleton: true
    });
  }

  public registerTransient<T>(key: string, factory: (container: DIContainer) => T) {
    this.services.set(key, {
      factory,
      isSingleton: false
    });
  }

  public resolve<T>(key: string): T {
    if (this.instances.has(key)) {
      return this.instances.get(key);
    }

    const registration = this.services.get(key);
    if (!registration) {
      throw new Error(`Service ${key} not registered`);
    }

    const instance = registration.factory(this);
    if (registration.isSingleton) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  public static resolve<T>(key: string): T {
    return DIContainer.getInstance().resolve(key);
  }
}