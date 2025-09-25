import { jest } from '@jest/globals';

jest.mock('../../../../src/modules/images/safety/local-nsfw', () => ({
  LocalNSFW: jest.fn(() => ({ check: jest.fn() })),
}));

describe('createSafetyProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SAFETY_VENDOR;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  function loadFactory() {
    return require('../../../../src/modules/images/safety')
      .createSafetyProvider as typeof import('../../../../src/modules/images/safety').createSafetyProvider;
  }

  function getLocalConstructor() {
    const mod =
      require('../../../../src/modules/images/safety/local-nsfw') as typeof import('../../../../src/modules/images/safety/local-nsfw');
    return jest.mocked(mod.LocalNSFW);
  }

  it('defaults to the local safety provider when SAFETY_VENDOR is not set', () => {
    const createSafetyProvider = loadFactory();
    const provider = createSafetyProvider();

    const LocalNSFW = getLocalConstructor();
    expect(LocalNSFW).toHaveBeenCalledTimes(1);
    expect(provider).toBe(LocalNSFW.mock.results[0]?.value);
  });

  it('normalizes SAFETY_VENDOR casing before matching', () => {
    process.env.SAFETY_VENDOR = 'LOCAL';
    const createSafetyProvider = loadFactory();
    const provider = createSafetyProvider();

    const LocalNSFW = getLocalConstructor();
    expect(LocalNSFW).toHaveBeenCalledTimes(1);
    expect(provider).toBe(LocalNSFW.mock.results[0]?.value);
  });

  it('throws for unknown safety vendors', () => {
    process.env.SAFETY_VENDOR = 'remote';
    const createSafetyProvider = loadFactory();

    expect(() => createSafetyProvider()).toThrow('Unknown SAFETY_VENDOR: remote');
    const LocalNSFW = getLocalConstructor();
    expect(LocalNSFW).not.toHaveBeenCalled();
  });
});
