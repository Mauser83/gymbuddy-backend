jest.mock('../../../src/prisma', () => ({
  prisma: {
    $executeRawUnsafe: jest.fn(),
  },
}));

import { writeImageEmbedding } from '../../../src/modules/cv/embeddingWriter';
import { prisma } from '../../../src/prisma';

describe('writeImageEmbedding', () => {
  beforeEach(() => {
    (prisma.$executeRawUnsafe as jest.Mock).mockClear();
  });

  it('updates global equipment images with embedding metadata', async () => {
    await writeImageEmbedding({
      target: 'GLOBAL',
      imageId: 'img-1',
      vector: [1, 2, 3],
      modelVendor: 'openai',
      modelName: 'clip',
      modelVersion: '1',
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "EquipmentImage"'),
      [1, 2, 3],
      'openai',
      'clip',
      '1',
      'img-1',
    );
  });

  it('updates gym equipment images when gymId is provided', async () => {
    await writeImageEmbedding({
      target: 'GYM',
      imageId: 'gym-img',
      gymId: 42,
      vector: [4, 5, 6],
      modelVendor: 'openai',
      modelName: 'clip',
      modelVersion: '2',
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "GymEquipmentImage"'),
      [4, 5, 6],
      'openai',
      'clip',
      '2',
      'gym-img',
      42,
    );
  });

  it('throws when writing gym embedding without gymId', async () => {
    await expect(
      writeImageEmbedding({
        target: 'GYM',
        imageId: 'missing-gym',
        vector: [],
        modelVendor: 'v',
        modelName: 'm',
        modelVersion: '1',
      }),
    ).rejects.toThrow('gymId is required for GYM embedding write');
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
