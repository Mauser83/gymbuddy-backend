import type { SafetyProvider } from "./provider";
import { LocalNSFW } from "./local-nsfw";

export function createSafetyProvider(): SafetyProvider {
  const vendor = (process.env.SAFETY_VENDOR ?? "local").toLowerCase();
  switch (vendor) {
    case "local":
      return new LocalNSFW();
    default:
      throw new Error(`Unknown SAFETY_VENDOR: ${vendor}`);
  }
}