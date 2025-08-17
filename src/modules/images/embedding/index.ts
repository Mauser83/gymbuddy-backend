import type { EmbeddingProvider } from './provider';
import { initLocalOpenCLIP, embedImage, EMBEDDING_DIM } from './local-openclip-light';

class LocalOpenClipLight implements EmbeddingProvider {
  dim = EMBEDDING_DIM;
  private initPromise = initLocalOpenCLIP();
  async embed(bytes: Uint8Array): Promise<number[]> {
    await this.initPromise;
    const vec = await embedImage(Buffer.from(bytes));
    return Array.from(vec);
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const vendor = (process.env.EMBED_VENDOR ?? 'local').toLowerCase();
  switch (vendor) {
    case 'local':
      return new LocalOpenClipLight();
    default:
      throw new Error(`Unknown EMBED_VENDOR: ${vendor}`);
  }
}