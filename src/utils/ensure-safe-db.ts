// src/test/ensure-safe-db.ts
import { URL } from 'node:url';

export function ensureSafeDb(url = process.env.DATABASE_URL, env = process.env.NODE_ENV) {
  if (env !== 'test') {
    throw new Error('Refusing to run tests: NODE_ENV must be "test".');
  }
  if (!url) {
    throw new Error('DATABASE_URL missing');
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  const host = u.hostname; // *.neon.tech
  const user = decodeURIComponent(u.username || ''); // e.g., gb_ci
  const db = (u.pathname || '').replace(/^\//, ''); // e.g., gymbuddy_test
  const params = u.searchParams;
  const options = params.get('options') || ''; // maybe "project_slug/dev_test"
  const branch = options.split('/')[1] || ''; // "dev_test" if present

  const isNeon = /\.neon\.tech$/i.test(host);
  const hasTestDbName = /(^|[_-])test(\b|$)/i.test(db); // gymbuddy_test
  const userLooksTest = /(^|[_.-])(ci|test)([_.-]|$)/i.test(user);
  const notOwner = !/owner/i.test(user); // avoid neondb_owner
  const branchLooksTest = branch ? /\b(ci|test)\b/i.test(branch) : true; // if missing, don't fail—DB+user must signal

  // CI “consent” switch: prevents accidental remote hits if secrets are miswired
  const ciConsent = process.env.CI ? process.env.CI_TEST_DB === 'true' : true;

  if (!isNeon) {
    throw new Error(`Unsafe host for tests: ${host} (expected *.neon.tech)`);
  }
  if (!hasTestDbName) {
    throw new Error(`Database name "${db}" must include "_test" for tests.`);
  }
  if (!userLooksTest || !notOwner) {
    throw new Error(`User "${user}" must be a dedicated test/ci role (not owner).`);
  }
  if (!branchLooksTest) {
    throw new Error(`Branch "${branch}" must look test/ci when provided via "options".`);
  }
  if (!ciConsent) {
    throw new Error('CI_TEST_DB=true is required in CI to use a remote test DB.');
  }
}
