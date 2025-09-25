const ORIGINAL_ENV = process.env;

describe('apiRouter bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('warns when the Google Maps API key is missing', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await Promise.resolve().then(() => require('../../src/api/apiRouter'));

    expect(warnSpy).toHaveBeenCalledWith(
      '[apiRouter] Maps_API_KEY is not set. Google calls will fail.',
    );

    warnSpy.mockRestore();
  });

  it('does not warn when an API key is provided', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await Promise.resolve().then(() => require('../../src/api/apiRouter'));

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

export {};
