import { GraphQLError } from 'graphql';

import {
  CreateTaxonomyDto,
  UpdateTaxonomyDto,
  ReorderTaxonomyDto,
} from '../../../src/modules/cv/taxonomy.dto';
import { TaxonomyResolvers } from '../../../src/modules/cv/taxonomy.resolvers';
import { validateInput } from '../../../src/middlewares/validation';

const listMock = jest.fn();
const getMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const setActiveMock = jest.fn();
const deleteMock = jest.fn();
const reorderMock = jest.fn();

jest.mock('../../../src/modules/cv/taxonomy.service', () => ({
  TaxonomyService: jest.fn(),
}));

jest.mock('../../../src/middlewares/validation', () => ({
  validateInput: jest.fn(),
}));

const taxonomyServiceModuleMock = jest.requireMock(
  '../../../src/modules/cv/taxonomy.service',
) as {
  TaxonomyService: jest.Mock;
};

const TaxonomyServiceMock = taxonomyServiceModuleMock.TaxonomyService as jest.Mock;
const validateInputMock = validateInput as jest.MockedFunction<typeof validateInput>;

let consoleErrorSpy: jest.SpyInstance;

describe('TaxonomyResolvers', () => {
  const context = { prisma: Symbol('prisma') } as any;

  beforeEach(() => {
    TaxonomyServiceMock.mockReset();
    listMock.mockReset();
    getMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    setActiveMock.mockReset();
    deleteMock.mockReset();
    reorderMock.mockReset();
    validateInputMock.mockReset();
    validateInputMock.mockResolvedValue(undefined);
    TaxonomyServiceMock.mockImplementation(() => ({
      list: listMock,
      get: getMock,
      create: createMock,
      update: updateMock,
      setActive: setActiveMock,
      delete: deleteMock,
      reorder: reorderMock,
    }));
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Query.taxonomyTypes', () => {
    it('delegates to the service list method', async () => {
      const rows = [{ id: 1 }];
      listMock.mockResolvedValue(rows);

      const result = await TaxonomyResolvers.Query.taxonomyTypes(
        null,
        { kind: 'SPLIT', active: true },
        context,
      );

      expect(TaxonomyServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(listMock).toHaveBeenCalledWith('SPLIT', true);
      expect(result).toBe(rows);
    });
  });

  describe('Query.taxonomyType', () => {
    it('fetches a single taxonomy record', async () => {
      const record = { id: 2 };
      getMock.mockResolvedValue(record);

      const result = await TaxonomyResolvers.Query.taxonomyType(
        null,
        { kind: 'ANGLE', id: 2 },
        context,
      );

      expect(TaxonomyServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(getMock).toHaveBeenCalledWith('ANGLE', 2);
      expect(result).toBe(record);
    });
  });

  describe('Mutation.createTaxonomyType', () => {
    const input = { key: 'front', label: 'Front', description: 'desc' } as const;

    it('validates input and returns the persisted row', async () => {
      const created = {
        id: 3,
        key: 'front',
        label: 'Front',
        active: true,
        displayOrder: 1,
        kind: 'ANGLE' as const,
      };
      createMock.mockResolvedValue(created);

      const result = await TaxonomyResolvers.Mutation.createTaxonomyType(
        null,
        { kind: 'ANGLE', input },
        context,
      );

      expect(validateInputMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'ANGLE', key: 'front', label: 'Front' }),
        CreateTaxonomyDto,
      );
      expect(createMock).toHaveBeenCalledWith('ANGLE', input);
      expect(result).toBe(created);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('throws when the service returns an incomplete row', async () => {
      createMock.mockResolvedValue({
        id: 4,
        key: 'side',
        label: null,
        active: true,
        displayOrder: 1,
        kind: 'ANGLE',
      } as any);

      await expect(
        TaxonomyResolvers.Mutation.createTaxonomyType(null, { kind: 'ANGLE', input }, context),
      ).rejects.toThrow('Service returned incomplete taxonomy row');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('maps unique constraint violations to a GraphQLError', async () => {
      const prismaError = Object.assign(new Error('unique violation'), { code: 'P2002' });
      createMock.mockRejectedValue(prismaError);

      await expect(
        TaxonomyResolvers.Mutation.createTaxonomyType(null, { kind: 'ANGLE', input }, context),
      ).rejects.toThrow(GraphQLError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(prismaError);
    });
  });

  describe('Mutation.updateTaxonomyType', () => {
    it('validates input and forwards the update request', async () => {
      const updateInput = { label: 'Updated' };
      updateMock.mockResolvedValue({ id: 5 });

      const result = await TaxonomyResolvers.Mutation.updateTaxonomyType(
        null,
        { kind: 'HEIGHT', id: 5, input: updateInput },
        context,
      );

      expect(validateInputMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'HEIGHT', id: 5, label: 'Updated' }),
        UpdateTaxonomyDto,
      );
      expect(updateMock).toHaveBeenCalledWith('HEIGHT', 5, updateInput);
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('Mutation.setTaxonomyActive', () => {
    it('delegates to the setActive service method', async () => {
      setActiveMock.mockResolvedValue({ id: 6, active: false });

      const result = await TaxonomyResolvers.Mutation.setTaxonomyActive(
        null,
        { kind: 'LIGHTING', id: 6, active: false },
        context,
      );

      expect(TaxonomyServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(setActiveMock).toHaveBeenCalledWith('LIGHTING', 6, false);
      expect(result).toEqual({ id: 6, active: false });
    });
  });

  describe('Mutation.deleteTaxonomyType', () => {
    it('requests deletion from the service', async () => {
      deleteMock.mockResolvedValue(true);

      const result = await TaxonomyResolvers.Mutation.deleteTaxonomyType(
        null,
        { kind: 'SOURCE', id: 7 },
        context,
      );

      expect(TaxonomyServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(deleteMock).toHaveBeenCalledWith('SOURCE', 7);
      expect(result).toBe(true);
    });
  });

  describe('Mutation.reorderTaxonomyTypes', () => {
    it('validates and forwards reorder payloads', async () => {
      const items = [
        { id: 1, displayOrder: 1 },
        { id: 2, displayOrder: 2 },
      ];
      const reordered = [{ id: 1 }, { id: 2 }];
      reorderMock.mockResolvedValue(reordered);

      const result = await TaxonomyResolvers.Mutation.reorderTaxonomyTypes(
        null,
        { kind: 'SPLIT', items },
        context,
      );

      expect(validateInputMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'SPLIT', items }),
        ReorderTaxonomyDto,
      );
      expect(reorderMock).toHaveBeenCalledWith('SPLIT', items);
      expect(result).toBe(reordered);
    });
  });
});