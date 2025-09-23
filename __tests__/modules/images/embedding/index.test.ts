jest.mock('../../../../src/modules/images/embedding/local-openclip-light', () => ({
  EMBEDDING_DIM: 512,
  initLocalOpenCLIP: jest.fn(() => Promise.resolve()),
  embedImage: jest.fn(() => Promise.resolve(Float32Array.from([1, 2, 3]))),
}));

import { embedImage, initLocalOpenCLIP } from '../../../../src/modules/images/embedding/local-openclip-light';
import { createEmbeddingProvider } from '../../../../src/modules/images/embedding';

const mockedInit = jest.mocked(initLocalOpenCLIP);
const mockedEmbed = jest.mocked(embedImage);

describe('createEmbeddingProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EMBED_VENDOR;
  });

  it('returns a local embedding provider that lazily initializes the model', async () => {
    process.env.EMBED_VENDOR = 'local';
    const provider = createEmbeddingProvider();
    expect(provider.dim).toBe(512);

    const vec = await provider.embed(Uint8Array.from([1, 2, 3]));
    expect(mockedInit).toHaveBeenCalledTimes(1);
    expect(mockedEmbed).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
    expect(vec).toEqual([1, 2, 3]);
  });

  it('throws for unknown vendors', () => {
    process.env.EMBED_VENDOR = 'unknown-vendor';
    expect(() => createEmbeddingProvider()).toThrow('Unknown EMBED_VENDOR');
  });
});