export type SafetyResult = { isSafe: boolean; nsfwScore: number; hasPerson?: boolean | null };
export interface SafetyProvider {
  check(bytes: Uint8Array): Promise<SafetyResult>;
}