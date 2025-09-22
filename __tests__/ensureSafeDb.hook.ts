// __tests__/ensureSafeDb.hook.ts
import { ensureSafeDb } from '../src/utils/ensure-safe-db';

// Fail fast if someone pointed tests at a non-test DB
ensureSafeDb();
