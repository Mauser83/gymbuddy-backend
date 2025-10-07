import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { validateInput } from '../../../src/middlewares/validation';
import { verifyGymScope, verifyRoles } from '../../../src/modules/auth/auth.roles';
import { PermissionService } from '../../../src/modules/core/permission.service';
import { EquipmentSuggestionService } from '../../../src/modules/equipment/equipment-suggestion.service';
import {
  ApproveEquipmentSuggestionDto,
  CreateEquipmentSuggestionDto,
  CreateEquipmentSuggestionUploadTicketDto,
  FinalizeEquipmentSuggestionImagesDto,
  ListEquipmentSuggestionsDto,
  RejectEquipmentSuggestionDto,
} from '../../../src/modules/equipment/equipment.dto';
import { queueImageProcessingForStorageKey } from '../../../src/modules/images/image-queue.helpers';
import { copyObjectIfMissing } from '../../../src/modules/media/media.service';
import { assertSizeWithinLimit } from '../../../src/modules/media/media.utils';
import { PrismaClient } from '../../../src/prisma';

jest.mock('../../../src/middlewares/validation');
jest.mock('../../../src/modules/auth/auth.roles');
jest.mock('../../../src/modules/images/image-queue.helpers');
jest.mock('../../../src/modules/media/media.service');
jest.mock('../../../src/modules/media/media.utils');
jest.mock('@aws-sdk/s3-request-presigner');

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: (...args: any[]) => sendMock(...args),
    })),
  };
});

process.env.R2_BUCKET = 'test-bucket';
process.env.R2_ACCOUNT_ID = 'account';
process.env.R2_ACCESS_KEY_ID = 'key';
process.env.R2_SECRET_ACCESS_KEY = 'secret';

describe('EquipmentSuggestionService', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let permissionService: PermissionService;
  let service: EquipmentSuggestionService;

  const mockedValidate = jest.mocked(validateInput as any);
  const mockedVerifyGymScope = jest.mocked(verifyGymScope as any);
  const mockedVerifyRoles = jest.mocked(verifyRoles as any);
  const mockedGetSignedUrl = jest.mocked(getSignedUrl as any);
  const mockedCopyObjectIfMissing = jest.mocked(copyObjectIfMissing as any);
  const mockedQueueImageProcessing = jest.mocked(queueImageProcessingForStorageKey as any);
  const mockedAssertSizeWithinLimit = jest.mocked(assertSizeWithinLimit as any);

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    permissionService = {} as any;
    service = new EquipmentSuggestionService(prisma, permissionService);

    mockedValidate.mockResolvedValue(undefined as any);
    mockedVerifyGymScope.mockReturnValue(undefined as any);
    mockedVerifyRoles.mockReturnValue(undefined as any);
    mockedGetSignedUrl.mockResolvedValue('signed-url');
    mockedCopyObjectIfMissing.mockResolvedValue(undefined as any);
    mockedQueueImageProcessing.mockResolvedValue(undefined as any);
    mockedAssertSizeWithinLimit.mockReturnValue(undefined as any);
    sendMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a suggestion and returns near matches', async () => {
    const suggestion = { id: 's1', images: [] } as any;
    prisma.equipmentSuggestion.create.mockResolvedValue(suggestion);
    prisma.equipment.findMany.mockResolvedValue([{ id: 33 } as any]);

    const result = await service.createSuggestion(
      {
        gymId: 12,
        name: 'Bench Press',
        brand: 'Rogue',
        description: 'Flat bench',
        manualUrl: 'http://manual',
        categoryId: 4,
        subcategoryId: 7,
        addToGymOnApprove: true,
      },
      { userId: 'manager-1' } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bench Press', gymId: 12 }),
      CreateEquipmentSuggestionDto,
    );
    expect(mockedVerifyGymScope).toHaveBeenCalledWith(
      { userId: 'manager-1' },
      permissionService,
      12,
    );
    expect(prisma.equipmentSuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gymId: 12,
        managerUserId: 'manager-1',
        name: 'Bench Press',
        brand: 'Rogue',
      }),
      include: { images: true },
    });
    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ categoryId: 4 })]),
        }),
      }),
    );
    expect(result).toEqual({ suggestion, nearMatches: [{ id: 33 }] });
  });

  it('lists suggestions with pagination metadata', async () => {
    const rows = [
      { id: 's1', images: [] },
      { id: 's2', images: [] },
      { id: 's3', images: [] },
    ] as any;
    prisma.equipmentSuggestion.findMany.mockResolvedValue(rows);

    const res = await service.listSuggestions(
      {
        status: 'PENDING' as any,
        limit: 2,
        gymId: 5,
        cursor: undefined,
      },
      { appRole: 'ADMIN' } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
      ListEquipmentSuggestionsDto,
    );
    expect(mockedVerifyRoles).toHaveBeenCalled();
    expect(prisma.equipmentSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: expect.objectContaining({ gymId: 5, status: 'PENDING' }),
      }),
    );
    expect(res).toEqual({ items: rows.slice(0, 2), nextCursor: 's3' });
  });

  it('creates an upload ticket for pending suggestions', async () => {
    prisma.equipmentSuggestion.findUnique.mockResolvedValue({
      managerUserId: 'manager-1',
      status: 'PENDING',
    } as any);

    const result = await service.createUploadTicket(
      {
        suggestionId: 's-1',
        upload: {
          contentLength: 1024,
          ext: 'jpg',
          contentType: 'image/jpeg',
          sha256: 'abc123',
        },
      },
      { userId: 'manager-1' } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ suggestionId: 's-1' }),
      CreateEquipmentSuggestionUploadTicketDto,
    );
    expect(mockedAssertSizeWithinLimit).toHaveBeenCalledWith(1024);
    expect(mockedGetSignedUrl).toHaveBeenCalled();
    expect(result).toEqual({
      putUrl: 'signed-url',
      storageKey: 'private/suggestions/candidates/s-1/abc123.jpg',
    });
  });

  it('finalizes uploaded images and stores metadata', async () => {
    prisma.equipmentSuggestion.findUnique.mockResolvedValue({
      managerUserId: 'manager-1',
      status: 'PENDING',
    } as any);
    sendMock.mockResolvedValue({ ContentLength: 2048 });
    prisma.equipmentSuggestionImage.upsert.mockResolvedValue({ id: 'img-1' } as any);

    const res = await service.finalizeImages(
      {
        suggestionId: 's-1',
        storageKeys: ['private/suggestions/candidates/s-1/sha1.jpg'],
      },
      { userId: 'manager-1' } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ suggestionId: 's-1' }),
      FinalizeEquipmentSuggestionImagesDto,
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(prisma.equipmentSuggestionImage.upsert).toHaveBeenCalledWith({
      where: { storageKey: 'private/suggestions/candidates/s-1/sha1.jpg' },
      update: { contentLength: 2048, sha256: 'sha1' },
      create: expect.objectContaining({
        suggestionId: 's-1',
        storageKey: 'private/suggestions/candidates/s-1/sha1.jpg',
        sha256: 'sha1',
        contentLength: 2048,
      }),
    });
    expect(res).toEqual([{ id: 'img-1' }]);
  });

  it('approves suggestion by updating existing equipment when merge provided', async () => {
    prisma.equipmentSuggestion.findUnique.mockResolvedValue({
      id: 's-1',
      status: 'PENDING',
      name: 'Trap Bar',
      description: null,
      brand: 'Rogue',
      manualUrl: 'http://manual',
      categoryId: 11,
      subcategoryId: 22,
      gymId: 8,
      addToGymOnApprove: true,
      managerUserId: 'manager-1',
      images: [
        {
          storageKey: 'private/suggestions/candidates/s-1/sha1.jpg',
          sha256: 'sha1',
        },
      ],
    } as any);
    prisma.equipment.findUnique.mockResolvedValue({ id: 55 } as any);
    prisma.gymEquipment.upsert.mockResolvedValue({ id: 91 } as any);
    prisma.gymEquipmentImage.upsert.mockResolvedValue({
      id: 'gym-img-1',
      storageKey: 'existing',
      sha256: null,
      nsfwScore: null,
      modelVendor: null,
      modelName: null,
      modelVersion: null,
    } as any);
    prisma.gymEquipmentImage.update.mockResolvedValue({} as any);
    prisma.globalImageSuggestion.upsert.mockResolvedValue({} as any);
    prisma.equipmentSuggestion.update.mockResolvedValue({} as any);

    const result = await service.approve(
      { id: 's-1', mergeIntoEquipmentId: 55 } as any,
      { appRole: 'ADMIN' } as any,
    );

    expect(prisma.equipment.findUnique).toHaveBeenCalledWith({ where: { id: 55 } });
    expect(prisma.equipment.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: {
        name: 'Trap Bar',
        brand: 'Rogue',
        manualUrl: 'http://manual',
      },
    });
    expect(prisma.equipment.create).not.toHaveBeenCalled();
    expect(prisma.gymEquipment.upsert).toHaveBeenCalledWith({
      where: { gymId_equipmentId: { gymId: 8, equipmentId: 55 } },
      update: {},
      create: { gymId: 8, equipmentId: 55, quantity: 1 },
    });
    expect(prisma.equipmentSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({ approvedEquipmentId: 55, status: 'APPROVED' }),
    });
    expect(result).toEqual({ approved: true, equipmentId: 55 });
  });

  it('approves suggestion by creating equipment and syncing images', async () => {
    prisma.equipmentSuggestion.findUnique.mockResolvedValue({
      id: 's-1',
      status: 'PENDING',
      name: 'Trap Bar',
      description: 'Hex bar',
      brand: 'Rogue',
      manualUrl: 'http://manual',
      categoryId: 11,
      subcategoryId: 22,
      gymId: 8,
      addToGymOnApprove: true,
      managerUserId: 'manager-1',
      images: [
        {
          storageKey: 'private/suggestions/candidates/s-1/sha1.jpg',
          sha256: 'sha1',
        },
      ],
    } as any);
    prisma.equipment.create.mockResolvedValue({ id: 55 } as any);
    prisma.gymEquipment.upsert.mockResolvedValue({ id: 91 } as any);
    prisma.gymEquipmentImage.upsert.mockResolvedValue({
      id: 'gym-img-1',
      storageKey: 'existing',
      sha256: null,
      nsfwScore: null,
      modelVendor: null,
      modelName: null,
      modelVersion: null,
    } as any);
    prisma.gymEquipmentImage.update.mockResolvedValue({} as any);
    prisma.globalImageSuggestion.upsert.mockResolvedValue({} as any);
    prisma.equipmentSuggestion.update.mockResolvedValue({} as any);

    const result = await service.approve({ id: 's-1' } as any, { appRole: 'ADMIN' } as any);

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's-1' }),
      ApproveEquipmentSuggestionDto,
    );
    expect(mockedVerifyRoles).toHaveBeenCalled();
    expect(prisma.equipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Trap Bar',
        brand: 'Rogue',
        categoryId: 11,
        subcategoryId: 22,
      }),
    });
    expect(prisma.gymEquipment.upsert).toHaveBeenCalledWith({
      where: { gymId_equipmentId: { gymId: 8, equipmentId: 55 } },
      update: {},
      create: { gymId: 8, equipmentId: 55, quantity: 1 },
    });
    expect(mockedCopyObjectIfMissing).toHaveBeenCalledWith(
      'private/suggestions/candidates/s-1/sha1.jpg',
      'private/global/candidates/55/sha1.jpg',
    );
    expect(mockedQueueImageProcessing).toHaveBeenCalled();
    expect(prisma.globalImageSuggestion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ equipmentId: 55 }),
        create: expect.objectContaining({ equipmentId: 55, sha256: 'sha1' }),
      }),
    );
    expect(prisma.equipmentSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedEquipmentId: 55,
      }),
    });
    expect(result).toEqual({ approved: true, equipmentId: 55 });
  });

  it('sets manual URL to null when suggestion omits it during merge', async () => {
    prisma.equipmentSuggestion.findUnique.mockResolvedValue({
      id: 's-2',
      status: 'PENDING',
      name: 'Trap Bar',
      description: null,
      brand: 'Rogue',
      manualUrl: null,
      categoryId: 11,
      subcategoryId: 22,
      gymId: null,
      addToGymOnApprove: false,
      managerUserId: 'manager-1',
      images: [],
    } as any);
    prisma.equipment.findUnique.mockResolvedValue({ id: 56 } as any);
    prisma.equipmentSuggestion.update.mockResolvedValue({} as any);

    await service.approve(
      { id: 's-2', mergeIntoEquipmentId: 56 } as any,
      { appRole: 'ADMIN' } as any,
    );

    expect(prisma.equipment.update).toHaveBeenCalledWith({
      where: { id: 56 },
      data: {
        name: 'Trap Bar',
        brand: 'Rogue',
        manualUrl: null,
      },
    });
  });

  it('rejects suggestion with provided reason', async () => {
    prisma.equipmentSuggestion.update.mockResolvedValue({} as any);

    const result = await service.reject(
      { id: 's-1', reason: 'duplicate' } as any,
      {
        appRole: 'ADMIN',
      } as any,
    );

    expect(mockedValidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's-1', reason: 'duplicate' }),
      RejectEquipmentSuggestionDto,
    );
    expect(mockedVerifyRoles).toHaveBeenCalled();
    expect(prisma.equipmentSuggestion.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: {
        status: 'REJECTED',
        rejectedReason: 'duplicate',
      },
    });
    expect(result).toEqual({ rejected: true });
  });
});
