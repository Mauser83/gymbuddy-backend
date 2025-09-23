import { GraphQLError } from 'graphql';

import { UpsertImageEmbeddingDto } from '../../../src/modules/cv/embedding.dto';
import { EmbeddingResolvers } from '../../../src/modules/cv/embedding.resolvers';
import { validateInput } from '../../../src/middlewares/validation';

const listByImageMock = jest.fn();
const getByIdMock = jest.fn();
const upsertMock = jest.fn();
const deleteMock = jest.fn();

jest.mock('../../../src/modules/cv/embedding.service', () => ({
  EmbeddingService: jest.fn(),
  getLatestEmbeddedImageService: jest.fn(),
}));

jest.mock('../../../src/middlewares/validation', () => ({
  validateInput: jest.fn(),
}));

const embeddingServiceModuleMock = jest.requireMock(
  '../../../src/modules/cv/embedding.service',
) as {
  EmbeddingService: jest.Mock;
  getLatestEmbeddedImageService: jest.Mock;
};
const { EmbeddingService: EmbeddingServiceMock } = embeddingServiceModuleMock;
const getLatestEmbeddedImageServiceMock =
  embeddingServiceModuleMock.getLatestEmbeddedImageService as jest.Mock;
const validateInputMock = validateInput as jest.MockedFunction<typeof validateInput>;

beforeEach(() => {
  EmbeddingServiceMock.mockReset();
  EmbeddingServiceMock.mockImplementation(() => ({
    listByImage: listByImageMock,
    getById: getByIdMock,
    upsert: upsertMock,
    delete: deleteMock,
  }));
  listByImageMock.mockReset();
  getByIdMock.mockReset();
  upsertMock.mockReset();
  deleteMock.mockReset();
  getLatestEmbeddedImageServiceMock.mockReset();
  validateInputMock.mockReset();
  validateInputMock.mockResolvedValue(undefined);
});

describe('EmbeddingResolvers', () => {
  const context = { prisma: Symbol('prisma') } as any;

  describe('Query.imageEmbeddings', () => {
    it('delegates to EmbeddingService.listByImage', async () => {
      const expected = [{ id: 'emb-1' }];
      listByImageMock.mockResolvedValue(expected);

      const result = await EmbeddingResolvers.Query.imageEmbeddings(
        null,
        { imageId: 'img-1', scope: 'GLOBAL' },
        context,
      );

      expect(EmbeddingServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(listByImageMock).toHaveBeenCalledWith('img-1', 'GLOBAL');
      expect(result).toBe(expected);
    });
  });

  describe('Query.imageEmbedding', () => {
    it('fetches a single embedding via the service', async () => {
      const record = { id: 'emb-2' };
      getByIdMock.mockResolvedValue(record);

      const result = await EmbeddingResolvers.Query.imageEmbedding(
        null,
        { id: 'emb-2' },
        context,
      );

      expect(EmbeddingServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(getByIdMock).toHaveBeenCalledWith('emb-2');
      expect(result).toBe(record);
    });
  });

  describe('Query.getLatestEmbeddedImage', () => {
    it('requires a scope value', async () => {
      await expect(
        EmbeddingResolvers.Query.getLatestEmbeddedImage({}, {} as any),
      ).rejects.toThrow(GraphQLError);
    });

    it('requires gymId for GYM scope', async () => {
      await expect(
        EmbeddingResolvers.Query.getLatestEmbeddedImage({}, { input: { scope: 'GYM' } }),
      ).rejects.toThrow('gymId is required for this scope');
    });

    it('forwards valid input to the service', async () => {
      const response = { imageId: 'image-1', createdAt: new Date(), scope: 'GLOBAL' as const };
      getLatestEmbeddedImageServiceMock.mockResolvedValue(response);

      const result = await EmbeddingResolvers.Query.getLatestEmbeddedImage({}, {
        input: { scope: 'GLOBAL' },
      });

      expect(getLatestEmbeddedImageServiceMock).toHaveBeenCalledWith({ scope: 'GLOBAL' });
      expect(result).toBe(response);
    });
  });

  describe('Mutation.upsertImageEmbedding', () => {
    it('validates input and calls service.upsert', async () => {
      const payload = { imageId: 'img-1' } as any;
      upsertMock.mockResolvedValue({ id: 'emb-3' });

      const result = await EmbeddingResolvers.Mutation.upsertImageEmbedding(
        null,
        { input: payload },
        context,
      );

      expect(validateInputMock).toHaveBeenCalledWith(payload, UpsertImageEmbeddingDto);
      expect(upsertMock).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ id: 'emb-3' });
    });
  });

  describe('Mutation.deleteImageEmbedding', () => {
    it('delegates to service.delete', async () => {
      deleteMock.mockResolvedValue(true);

      const result = await EmbeddingResolvers.Mutation.deleteImageEmbedding(
        null,
        { id: 'emb-4' },
        context,
      );

      expect(EmbeddingServiceMock).toHaveBeenCalledWith(context.prisma);
      expect(deleteMock).toHaveBeenCalledWith('emb-4');
      expect(result).toBe(true);
    });
  });
});