import { jest } from '@jest/globals';
import request from 'supertest';

describe('server configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('enables quiet dotenv output when running tests', async () => {
    delete process.env.DOTENV_CONFIG_QUIET;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-secret';

    await jest.isolateModulesAsync(async () => {
      expect(process.env.DOTENV_CONFIG_QUIET).toBeUndefined();

      require('../../src/server.js');

      expect(process.env.DOTENV_CONFIG_QUIET).toBe('true');
    });
  });

  test('allows Expo localhost origins through CORS', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-secret';

    const { app } = require('../../src/server.js');

    const res = await request(app).get('/health').set('Origin', 'http://localhost:8081');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });

  test('blocks unknown origins via CORS middleware', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-secret';

    const { app } = require('../../src/server.js');

    const res = await request(app).get('/health').set('Origin', 'http://malicious.example.com');

    expect(res.status).toBe(500);
    expect(res.text).toContain('Not allowed by CORS');
  });

  type MetricsImplementation = () => Promise<string>;

  const setupPrometheusMock = (metricsImplementation: MetricsImplementation) => {
    const histogramInstance = {
      labels: jest.fn().mockReturnThis(),
      observe: jest.fn(),
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    };

    const gaugeInstance = {
      labels: jest.fn().mockReturnThis(),
      set: jest.fn(),
    };

    const metricsMock: jest.MockedFunction<MetricsImplementation> = jest.fn(metricsImplementation);

    jest.doMock('prom-client', () => ({
      Histogram: jest.fn(() => histogramInstance),
      Gauge: jest.fn(() => gaugeInstance),
      collectDefaultMetrics: jest.fn(),
      register: {
        contentType: 'text/plain',
        metrics: metricsMock,
      },
    }));

    return metricsMock;
  };

  test('exposes Prometheus metrics with a text/plain content type', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-secret';

    let response: request.Response | undefined;

    await jest.isolateModulesAsync(async () => {
      const metricsMock = setupPrometheusMock(async () => 'metric-data');

      const { app } = require('../../src/server.js');
      response = await request(app).get('/metrics');

      expect(metricsMock).toHaveBeenCalledTimes(1);
    });

    expect(response?.status).toBe(200);
    expect(response?.text).toBe('metric-data');
    expect(response?.headers['content-type']).toBe('text/plain');
  });

  test('handles Prometheus metric collection failures', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-secret';

    let response: request.Response | undefined;

    await jest.isolateModulesAsync(async () => {
      const metricsMock = setupPrometheusMock(async () => {
        throw new Error('metrics failed');
      });

      const { app } = require('../../src/server.js');
      response = await request(app).get('/metrics');

      expect(metricsMock).toHaveBeenCalledTimes(1);
    });

    expect(response?.status).toBe(500);
    expect(response?.body).toEqual({
      error: 'Internal Server Error',
      message: 'metrics failed',
    });
  });
});
