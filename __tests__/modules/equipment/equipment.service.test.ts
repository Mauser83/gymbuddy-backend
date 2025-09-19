import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaClient } from '../../../src/lib/prisma';
import { validateInput } from '../../../src/middlewares/validation';
import { verifyRoles } from '../../../src/modules/auth/auth.roles';
import { PermissionService } from '../../../src/modules/core/permission.service';
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
  UploadEquipmentImageDto,
  DeleteEquipmentImageDto,
  CreateEquipmentCategoryDto,
  UpdateEquipmentCategoryDto,
  CreateEquipmentSubcategoryDto,
  UpdateEquipmentSubcategoryDto,
} from '../../../src/modules/equipment/equipment.dto';
import { EquipmentService } from '../../../src/modules/equipment/equipment.service';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles');

const mockedValidate = jest.mocked(validateInput as any);
const mockedVerify = jest.mocked(verifyRoles as any);

describe('EquipmentService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: EquipmentService;
  let permissionService: PermissionService;
  const ctx: any = {};

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permissionService = {} as any;
    service = new EquipmentService(prisma, permissionService);
    mockedValidate.mockResolvedValue(undefined as any);
    mockedVerify.mockReturnValue();
  });

  afterEach(() => jest.clearAllMocks());

  test('createEquipment validates, checks roles and creates equipment', async () => {
    prisma.equipment.create.mockResolvedValue({ id: 1 } as any);
    const input = { name: 'bench', brand: 'b', categoryId: 1 } as any;
    const result = await service.createEquipment(input, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateEquipmentDto);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipment.create).toHaveBeenCalledWith({
      data: { ...input },
    });
    expect(result).toEqual({ id: 1 });
  });

  test('createEquipment propagates verifyRoles error', async () => {
    mockedVerify.mockImplementation(() => {
      throw new Error('no');
    });
    await expect(service.createEquipment({} as any, ctx)).rejects.toThrow('no');
    expect(prisma.equipment.create).not.toHaveBeenCalled();
  });

  test('getEquipment fetches by id', async () => {
    prisma.equipment.findUnique.mockResolvedValue({ id: 2 } as any);
    const res = await service.getEquipment(2);
    expect(prisma.equipment.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
    });
    expect(res).toEqual({ id: 2 });
  });

  test('getAllEquipments without search', async () => {
    prisma.equipment.findMany.mockResolvedValue([]);
    await service.getAllEquipments();
    expect(prisma.equipment.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { category: true, subcategory: true },
    });
  });

  test('getAllEquipments with search', async () => {
    prisma.equipment.findMany.mockResolvedValue([]);
    await service.getAllEquipments('abc');
    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  test('getGymEquipmentByGymId forwards parameters', async () => {
    prisma.gymEquipment.findMany.mockResolvedValue([]);
    await service.getGymEquipmentByGymId(3);
    expect(prisma.gymEquipment.findMany).toHaveBeenCalledWith({
      where: { gymId: 3 },
      include: {
        equipment: {
          include: { subcategory: { select: { id: true } } },
        },
      },
    });
  });

  test('updateEquipment validates, checks roles and updates', async () => {
    prisma.equipment.update.mockResolvedValue({ id: 5 } as any);
    const result = await service.updateEquipment(5, { name: 'n' } as any, ctx);
    expect(mockedValidate).toHaveBeenCalledWith({ name: 'n' }, UpdateEquipmentDto);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipment.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: 'n' },
    });
    expect(result).toEqual({ id: 5 });
  });

  test('deleteEquipment checks roles and deletes', async () => {
    prisma.equipment.delete.mockResolvedValue({} as any);
    await service.deleteEquipment(7, ctx);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipment.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  test('uploadEquipmentImage validates, checks roles and creates image', async () => {
    prisma.equipmentImage.create.mockResolvedValue({ id: '1' } as any);
    const input: any = {
      equipmentId: 1,
      storageKey: 'key',
      sha256: 'hash',
    };
    await service.uploadEquipmentImage(input, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(input, UploadEquipmentImageDto);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipmentImage.create).toHaveBeenCalledWith({
      data: {
        equipmentId: 1,
        storageKey: 'key',
        sha256: 'hash',
      },
    });
  });

  test('deleteEquipmentImage checks roles and deletes', async () => {
    prisma.equipmentImage.delete.mockResolvedValue({} as any);
    const res = await service.deleteEquipmentImage('2', ctx);
    expect(mockedValidate).toHaveBeenCalledWith({ imageId: '2' }, DeleteEquipmentImageDto);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipmentImage.delete).toHaveBeenCalledWith({
      where: { id: '2' },
    });
    expect(res).toBe(true);
  });

  test('createEquipmentCategory validates and creates', async () => {
    prisma.equipmentCategory.create.mockResolvedValue({ id: 1 } as any);
    const input = { name: 'c', slug: 'c' } as any;
    await service.createEquipmentCategory(input, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateEquipmentCategoryDto);
    expect(prisma.equipmentCategory.create).toHaveBeenCalledWith({
      data: input,
    });
  });

  test('updateEquipmentCategory validates and updates', async () => {
    prisma.equipmentCategory.update.mockResolvedValue({ id: 1 } as any);
    await service.updateEquipmentCategory(1, { name: 'n', slug: 's' } as any, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(
      { name: 'n', slug: 's' },
      UpdateEquipmentCategoryDto,
    );
    expect(prisma.equipmentCategory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'n', slug: 's' },
    });
  });

  test('deleteEquipmentCategory checks roles and deletes', async () => {
    prisma.equipmentCategory.delete.mockResolvedValue({} as any);
    await service.deleteEquipmentCategory(4, ctx);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipmentCategory.delete).toHaveBeenCalledWith({
      where: { id: 4 },
    });
  });

  test('createEquipmentSubcategory validates and creates', async () => {
    prisma.equipmentSubcategory.create.mockResolvedValue({ id: 1 } as any);
    const input = { name: 's', slug: 's', categoryId: 2 } as any;
    await service.createEquipmentSubcategory(input, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(input, CreateEquipmentSubcategoryDto);
    expect(prisma.equipmentSubcategory.create).toHaveBeenCalledWith({
      data: input,
    });
  });

  test('updateEquipmentSubcategory validates and updates', async () => {
    prisma.equipmentSubcategory.update.mockResolvedValue({ id: 1 } as any);
    const input = { name: 's', slug: 's' } as any;
    await service.updateEquipmentSubcategory(1, input, ctx);
    expect(mockedValidate).toHaveBeenCalledWith(input, UpdateEquipmentSubcategoryDto);
    expect(prisma.equipmentSubcategory.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: input,
    });
  });

  test('deleteEquipmentSubcategory checks roles and deletes', async () => {
    prisma.equipmentSubcategory.delete.mockResolvedValue({} as any);
    await service.deleteEquipmentSubcategory(5, ctx);
    expect(mockedVerify).toHaveBeenCalled();
    expect(prisma.equipmentSubcategory.delete).toHaveBeenCalledWith({
      where: { id: 5 },
    });
  });
});
