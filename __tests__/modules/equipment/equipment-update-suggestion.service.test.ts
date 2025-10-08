import { GraphQLError } from 'graphql';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { validateInput } from '../../../src/middlewares/validation';
import { verifyRoles } from '../../../src/modules/auth/auth.roles';
import { EquipmentUpdateSuggestionService } from '../../../src/modules/equipment/equipment-update-suggestion.service';
import { PrismaClient } from '../../../src/prisma';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles');

describe('EquipmentUpdateSuggestionService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: EquipmentUpdateSuggestionService;

  const mockedValidate = jest.mocked(validateInput as any);
  const mockedVerifyRoles = jest.mocked(verifyRoles as any);

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockResolvedValue([] as any);

    service = new EquipmentUpdateSuggestionService(prisma);

    mockedValidate.mockResolvedValue(undefined);
    mockedVerifyRoles.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication when creating a suggestion', async () => {
    await expect(
      service.create(
        {
          equipmentId: 1,
          proposedName: 'Trap Bar',
          proposedBrand: 'Rogue',
        },
        {} as any,
      ),
    ).rejects.toThrow(GraphQLError);
  });

  it('creates a suggestion when equipment exists', async () => {
    prisma.equipment.findUnique.mockResolvedValue({ id: 1 } as any);
    prisma.equipmentUpdateSuggestion.create.mockResolvedValue({ id: 's-1' } as any);

    const result = await service.create(
      {
        equipmentId: 1,
        proposedName: 'Trap Bar',
        proposedBrand: 'Rogue',
        proposedManualUrl: 'http://manual',
      },
      { userId: 42 } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: 1, proposedBrand: 'Rogue' }),
      expect.any(Function),
    );
    expect(prisma.equipment.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });
    expect(prisma.equipmentUpdateSuggestion.create).toHaveBeenCalledWith({
      data: {
        equipmentId: 1,
        proposedName: 'Trap Bar',
        proposedBrand: 'Rogue',
        proposedManualUrl: 'http://manual',
        submittedByUserId: 42,
        status: 'PENDING',
      },
    });
    expect(result).toEqual({ suggestion: { id: 's-1' } });
  });

  it('throws when equipment is missing during creation', async () => {
    prisma.equipment.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          equipmentId: 9,
          proposedName: 'Trap Bar',
          proposedBrand: 'Rogue',
        },
        { userId: 1 } as any,
      ),
    ).rejects.toThrow('Equipment not found');
    expect(prisma.equipmentUpdateSuggestion.create).not.toHaveBeenCalled();
  });

  it('approves a pending suggestion and updates the equipment', async () => {
    prisma.equipmentUpdateSuggestion.findUnique.mockResolvedValue({
      id: 's-1',
      equipmentId: 55,
      status: 'PENDING',
      proposedName: 'Updated Trap Bar',
      proposedBrand: 'Rogue',
      proposedManualUrl: null,
    } as any);
    prisma.equipment.update.mockResolvedValue({} as any);
    prisma.equipmentUpdateSuggestion.update.mockResolvedValue({} as any);

    const result = await service.approve({ id: 's-1' }, { userId: 7 } as any);

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's-1' }),
      expect.any(Function),
    );
    expect(mockedVerifyRoles).toHaveBeenCalled();
    expect(prisma.equipment.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: {
        name: 'Updated Trap Bar',
        brand: 'Rogue',
        manualUrl: null,
      },
    });
    expect(prisma.equipmentUpdateSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: {
        status: 'APPROVED',
        approvedByUserId: 7,
        approvedAt: expect.any(Date),
      },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ approved: true, equipmentId: 55 });
  });

  it('throws when approving a non-existent suggestion', async () => {
    prisma.equipmentUpdateSuggestion.findUnique.mockResolvedValue(null);

    await expect(service.approve({ id: 'missing' }, { userId: 1 } as any)).rejects.toThrow(
      'Suggestion not found',
    );
    expect(prisma.equipment.update).not.toHaveBeenCalled();
  });

  it('rejects a pending suggestion with a reason', async () => {
    prisma.equipmentUpdateSuggestion.findUnique.mockResolvedValue({ status: 'PENDING' } as any);
    prisma.equipmentUpdateSuggestion.update.mockResolvedValue({} as any);

    const result = await service.reject({ id: 's-1', reason: 'duplicate' }, { userId: 3 } as any);

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's-1' }),
      expect.any(Function),
    );
    expect(mockedVerifyRoles).toHaveBeenCalled();
    expect(prisma.equipmentUpdateSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: {
        status: 'REJECTED',
        rejectedReason: 'duplicate',
      },
    });
    expect(result).toEqual({ rejected: true });
  });

  it('throws when rejecting a non-existent suggestion', async () => {
    prisma.equipmentUpdateSuggestion.findUnique.mockResolvedValue(null);

    await expect(service.reject({ id: 'missing' }, { userId: 3 } as any)).rejects.toThrow(
      'Suggestion not found',
    );
    expect(prisma.equipmentUpdateSuggestion.update).not.toHaveBeenCalled();
  });
});
