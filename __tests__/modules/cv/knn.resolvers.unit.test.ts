import { GraphQLError } from 'graphql';

import { KnnResolvers } from '../../../src/modules/cv/knn.resolvers';
import { knnSearchService } from '../../../src/modules/cv/knn.service';

jest.mock('../../../src/modules/cv/knn.service', () => ({
  knnSearchService: jest.fn(),
}));

const knnSearchServiceMock = knnSearchService as jest.MockedFunction<typeof knnSearchService>;

describe('KnnResolvers.knnSearch', () => {
  beforeEach(() => {
    knnSearchServiceMock.mockReset();
  });

  it('requires an imageId', async () => {
    await expect(
      KnnResolvers.Query.knnSearch({}, { input: { scope: 'GLOBAL', limit: 1 } }),
    ).rejects.toThrow(GraphQLError);
    expect(knnSearchServiceMock).not.toHaveBeenCalled();
  });

  it('requires gymId when scope is gym-like', async () => {
    await expect(
      KnnResolvers.Query.knnSearch({}, { input: { imageId: 'abc', scope: 'GYM', limit: 2 } }),
    ).rejects.toThrow(/gymId is required/);
    expect(knnSearchServiceMock).not.toHaveBeenCalled();
  });

  it('returns empty list when service yields no rows', async () => {
    knnSearchServiceMock.mockResolvedValueOnce([]);

    const result = await KnnResolvers.Query.knnSearch(
      {},
      {
        input: { imageId: 'img-1', scope: 'GLOBAL', limit: 4 },
      },
    );

    expect(knnSearchServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: 'img-1', scope: 'GLOBAL', limit: 4 }),
    );
    expect(result).toEqual([]);
  });

  it('maps neighbors returned from the service', async () => {
    knnSearchServiceMock.mockResolvedValueOnce([
      { id: 'b', equipmentId: null, score: 0.42, storageKey: 'b.jpg' },
      { id: 'a', equipmentId: 7, score: 0.9, storageKey: 'a.jpg' },
    ]);

    const result = await KnnResolvers.Query.knnSearch(
      {},
      {
        input: { imageId: 'img-2', scope: 'GLOBAL', gymId: 1, limit: 2, minScore: 0.5 },
      },
    );

    expect(knnSearchServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: 'img-2',
        scope: 'GLOBAL',
        limit: 2,
        gymId: 1,
        minScore: 0.5,
      }),
    );
    expect(result).toEqual([
      { imageId: 'b', equipmentId: null, score: 0.42, storageKey: 'b.jpg' },
      { imageId: 'a', equipmentId: 7, score: 0.9, storageKey: 'a.jpg' },
    ]);
  });
});
