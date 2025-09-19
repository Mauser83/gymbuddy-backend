import { LocalNSFW } from './local-nsfw';
import type { SafetyProvider } from './provider';

export function createSafetyProvider(): SafetyProvider {
  const vendor = (process.env.SAFETY_VENDOR ?? 'local').toLowerCase();
  switch (vendor) {
    case 'local':
      return new LocalNSFW();
    default:
      throw new Error(`Unknown SAFETY_VENDOR: ${vendor}`);
  }
}
