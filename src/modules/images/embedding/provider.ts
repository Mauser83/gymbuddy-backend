export interface EmbeddingProvider {
  dim: number;
  embed(bytes: Uint8Array): Promise<number[]>; // length = dim
}