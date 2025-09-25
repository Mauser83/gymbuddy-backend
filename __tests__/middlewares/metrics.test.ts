const promBundleMock = jest.fn();

jest.mock('express-prom-bundle', () => promBundleMock);

describe('metrics middleware', () => {
  const originalVersion = process.env.npm_package_version;

  beforeEach(() => {
    jest.resetModules();
    promBundleMock.mockReset();
  });

  afterAll(() => {
    if (originalVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = originalVersion;
    }
  });

  it('uses the package version from the environment when provided', () => {
    process.env.npm_package_version = '9.9.9';
    promBundleMock.mockReturnValueOnce('middleware-with-version');

    const { metricsMiddleware } = require('../../src/middlewares/metrics');

    expect(promBundleMock).toHaveBeenCalledWith({
      includeMethod: true,
      includePath: true,
      includeStatusCode: true,
      includeUp: true,
      customLabels: { app: 'gymbuddy_backend', version: '9.9.9' },
      promClient: { collectDefaultMetrics: { timeout: 5000 } },
    });
    expect(metricsMiddleware).toBe('middleware-with-version');
  });

  it('falls back to an unknown version label when the env var is missing', () => {
    delete process.env.npm_package_version;
    promBundleMock.mockReturnValueOnce('middleware-with-unknown-version');

    const { metricsMiddleware } = require('../../src/middlewares/metrics');

    expect(promBundleMock).toHaveBeenCalledWith({
      includeMethod: true,
      includePath: true,
      includeStatusCode: true,
      includeUp: true,
      customLabels: { app: 'gymbuddy_backend', version: 'unknown' },
      promClient: { collectDefaultMetrics: { timeout: 5000 } },
    });
    expect(metricsMiddleware).toBe('middleware-with-unknown-version');
  });
});
