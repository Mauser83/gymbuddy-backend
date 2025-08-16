import type { EmbeddingProvider } from "./provider";
import { LocalOpenClip } from "./local-openclip";

export function createEmbeddingProvider(): EmbeddingProvider {
  const vendor = (process.env.EMBED_VENDOR ?? "local").toLowerCase();
  switch (vendor) {
    case "local":
      return new LocalOpenClip();
    default:
      throw new Error(`Unknown EMBED_VENDOR: ${vendor}`);
  }
}