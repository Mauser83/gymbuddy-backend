import { ensureSafeDb } from '../../src/utils/ensure-safe-db';

describe('ensureSafeDb', () => {
  const originalCI = process.env.CI;
  const originalCIConsent = process.env.CI_TEST_DB;

  afterEach(() => {
    process.env.CI = originalCI;
    process.env.CI_TEST_DB = originalCIConsent;
  });

  it('throws when NODE_ENV is not test', () => {
    expect(() =>
      ensureSafeDb('postgres://ci_user@demo.neon.tech/gymbuddy_test', 'development'),
    ).toThrow('NODE_ENV must be "test"');
  });

  it('throws when database url is missing', () => {
    expect(() => ensureSafeDb('', 'test')).toThrow('DATABASE_URL missing');
  });

  it('throws when host is not neon.tech', () => {
    expect(() => ensureSafeDb('postgres://ci_user@localhost/gymbuddy_test', 'test')).toThrow(
      'Unsafe host for tests',
    );
  });

  it('throws when database name does not include test', () => {
    expect(() => ensureSafeDb('postgres://ci_user@demo.neon.tech/gymbuddy', 'test')).toThrow(
      'must include "_test"',
    );
  });

  it('throws when user is not a dedicated test role', () => {
    expect(() => ensureSafeDb('postgres://owner@demo.neon.tech/gymbuddy_test', 'test')).toThrow(
      'must be a dedicated test/ci role',
    );
  });

  it('throws when branch provided does not look like test', () => {
    expect(() =>
      ensureSafeDb('postgres://ci_user@demo.neon.tech/gymbuddy_test?options=proj/main', 'test'),
    ).toThrow('Branch');
  });

  it('throws when CI consent flag is missing', () => {
    process.env.CI = 'true';
    process.env.CI_TEST_DB = 'false';

    expect(() => ensureSafeDb('postgres://ci_user@demo.neon.tech/gymbuddy_test', 'test')).toThrow(
      'CI_TEST_DB=true is required',
    );
  });

  it('allows safe configuration', () => {
    process.env.CI = 'true';
    process.env.CI_TEST_DB = 'true';

    expect(() =>
      ensureSafeDb('postgres://ci_user@demo.neon.tech/gymbuddy_test?options=proj/test', 'test'),
    ).not.toThrow();
  });
});
