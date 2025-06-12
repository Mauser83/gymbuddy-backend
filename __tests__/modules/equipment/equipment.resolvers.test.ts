import { EquipmentResolvers } from '../../../src/modules/equipment/equipment.resolvers';
import { EquipmentService } from '../../../src/modules/equipment/equipment.service';
import { PermissionService } from '../../../src/modules/core/permission.service';

jest.mock('../../../src/modules/equipment/equipment.service');

const mockedService = jest.mocked(EquipmentService);

function createContext() {
  return {
    prisma: {
      equipmentCategory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      equipmentSubcategory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      equipmentImage: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      exercise: { findMany: jest.fn() },
      gymEquipment: { findMany: jest.fn() },
      equipment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    } as any,
    userId: 1,
    permissionService: new PermissionService({} as any),
  } as any;
}

describe('EquipmentResolvers', () => {
  beforeEach(() => {
    mockedService.mockClear();
  });

  describe('field resolvers', () => {
    test('Equipment.category', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentCategory.findUnique.mockResolvedValue({ id: 1 });
      const res = await EquipmentResolvers.Equipment.category({ categoryId: 1 }, {}, ctx);
      expect(ctx.prisma.equipmentCategory.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res).toEqual({ id: 1 });
    });

    test('Equipment.subcategory returns null when no id', async () => {
      const ctx = createContext();
      const res = await EquipmentResolvers.Equipment.subcategory({ subcategoryId: null }, {}, ctx);
      expect(res).toBeNull();
      expect(ctx.prisma.equipmentSubcategory.findUnique).not.toHaveBeenCalled();
    });

    test('Equipment.subcategory fetches when id present', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentSubcategory.findUnique.mockResolvedValue({ id: 2 });
      const res = await EquipmentResolvers.Equipment.subcategory({ subcategoryId: 2 }, {}, ctx);
      expect(ctx.prisma.equipmentSubcategory.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(res).toEqual({ id: 2 });
    });

    test('Equipment.images fetches list', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentImage.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await EquipmentResolvers.Equipment.images({ id: 3 }, {}, ctx);
      expect(ctx.prisma.equipmentImage.findMany).toHaveBeenCalledWith({ where: { equipmentId: 3 } });
      expect(res).toEqual([{ id: 1 }]);
    });

    test('Equipment.compatibleExercises empty when no subcategory', async () => {
      const ctx = createContext();
      const res = await EquipmentResolvers.Equipment.compatibleExercises({ subcategoryId: undefined }, {}, ctx);
      expect(res).toEqual([]);
      expect(ctx.prisma.exercise.findMany).not.toHaveBeenCalled();
    });

    test('Equipment.compatibleExercises queries when subcategory present', async () => {
      const ctx = createContext();
      ctx.prisma.exercise.findMany.mockResolvedValue([{ id: 1 }]);
      const res = await EquipmentResolvers.Equipment.compatibleExercises({ subcategoryId: 4 }, {}, ctx);
      expect(ctx.prisma.exercise.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          equipmentSlots: {
            some: {
              options: {
                some: { subcategoryId: 4 },
              },
            },
          },
        },
      });
      expect(res).toEqual([{ id: 1 }]);
    });

    test('EquipmentCategory.subcategories', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentSubcategory.findMany.mockResolvedValue([]);
      await EquipmentResolvers.EquipmentCategory.subcategories({ id: 5 }, {}, ctx);
      expect(ctx.prisma.equipmentSubcategory.findMany).toHaveBeenCalledWith({ where: { categoryId: 5 } });
    });

    test('EquipmentSubcategory.category', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentCategory.findUnique.mockResolvedValue({ id: 1 });
      await EquipmentResolvers.EquipmentSubcategory.category({ categoryId: 1 }, {}, ctx);
      expect(ctx.prisma.equipmentCategory.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('Query resolvers', () => {
    test('equipment uses service', async () => {
      const serviceInstance = { getEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Query.equipment(null as any, { id: 1 }, ctx);
      expect(serviceInstance.getEquipment).toHaveBeenCalledWith(1);
    });

    test('allEquipments uses service', async () => {
      const serviceInstance = { getAllEquipments: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Query.allEquipments(null as any, { search: 'a' }, ctx);
      expect(serviceInstance.getAllEquipments).toHaveBeenCalledWith('a');
    });

    test('equipmentCategories queries prisma', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentCategory.findMany.mockResolvedValue([]);
      await EquipmentResolvers.Query.equipmentCategories(null as any, {}, ctx);
      expect(ctx.prisma.equipmentCategory.findMany).toHaveBeenCalledWith({ include: { subcategories: true } });
    });

    test('equipmentSubcategories queries prisma with optional categoryId', async () => {
      const ctx = createContext();
      ctx.prisma.equipmentSubcategory.findMany.mockResolvedValue([]);
      await EquipmentResolvers.Query.equipmentSubcategories(null as any, { categoryId: 2 }, ctx);
      expect(ctx.prisma.equipmentSubcategory.findMany).toHaveBeenCalledWith({ where: { categoryId: 2 } });
    });

    test('gymEquipmentByGymId uses service', async () => {
      const serviceInstance = { getGymEquipmentByGymId: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Query.gymEquipmentByGymId(null as any, { gymId: 7 }, ctx);
      expect(serviceInstance.getGymEquipmentByGymId).toHaveBeenCalledWith(7);
    });
  });

  describe('Mutation resolvers', () => {
    test('createEquipment uses service', async () => {
      const serviceInstance = { createEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.createEquipment(null as any, { input: { a: 1 } }, ctx);
      expect(serviceInstance.createEquipment).toHaveBeenCalled();
    });

    test('updateEquipment uses service', async () => {
      const serviceInstance = { updateEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.updateEquipment(null as any, { id: 1, input: {} }, ctx);
      expect(serviceInstance.updateEquipment).toHaveBeenCalled();
    });

    test('deleteEquipment uses service', async () => {
      const serviceInstance = { deleteEquipment: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.deleteEquipment(null as any, { id: 1 }, ctx);
      expect(serviceInstance.deleteEquipment).toHaveBeenCalled();
    });

    test('uploadEquipmentImage uses service', async () => {
      const serviceInstance = { uploadEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.uploadEquipmentImage(null as any, { input: {} }, ctx);
      expect(serviceInstance.uploadEquipmentImage).toHaveBeenCalled();
    });

    test('deleteEquipmentImage uses service', async () => {
      const serviceInstance = { deleteEquipmentImage: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.deleteEquipmentImage(null as any, { imageId: 2 }, ctx);
      expect(serviceInstance.deleteEquipmentImage).toHaveBeenCalled();
    });

    test('createEquipmentCategory uses service', async () => {
      const serviceInstance = { createEquipmentCategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.createEquipmentCategory(null as any, { input: {} }, ctx);
      expect(serviceInstance.createEquipmentCategory).toHaveBeenCalled();
    });

    test('updateEquipmentCategory uses service', async () => {
      const serviceInstance = { updateEquipmentCategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.updateEquipmentCategory(null as any, { id: 1, input: {} }, ctx);
      expect(serviceInstance.updateEquipmentCategory).toHaveBeenCalled();
    });

    test('deleteEquipmentCategory uses service', async () => {
      const serviceInstance = { deleteEquipmentCategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.deleteEquipmentCategory(null as any, { id: 1 }, ctx);
      expect(serviceInstance.deleteEquipmentCategory).toHaveBeenCalled();
    });

    test('createEquipmentSubcategory uses service', async () => {
      const serviceInstance = { createEquipmentSubcategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.createEquipmentSubcategory(null as any, { input: {} }, ctx);
      expect(serviceInstance.createEquipmentSubcategory).toHaveBeenCalled();
    });

    test('updateEquipmentSubcategory uses service', async () => {
      const serviceInstance = { updateEquipmentSubcategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.updateEquipmentSubcategory(null as any, { id: 1, input: {} }, ctx);
      expect(serviceInstance.updateEquipmentSubcategory).toHaveBeenCalled();
    });

    test('deleteEquipmentSubcategory uses service', async () => {
      const serviceInstance = { deleteEquipmentSubcategory: jest.fn() } as any;
      mockedService.mockImplementation(() => serviceInstance);
      const ctx = createContext();
      await EquipmentResolvers.Mutation.deleteEquipmentSubcategory(null as any, { id: 1 }, ctx);
      expect(serviceInstance.deleteEquipmentSubcategory).toHaveBeenCalled();
    });
  });
});