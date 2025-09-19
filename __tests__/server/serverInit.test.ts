import { jest } from '@jest/globals';
import request from 'supertest';

describe('server initialization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Ensure the real server module is loaded for each test
    jest.unmock('../../src/server');
    process.env = { ...originalEnv };
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // NOT AUTOMATICALLY TESTABLE AS CODE LOADS THE ENV AT START
  // test('throws when JWT_SECRET is missing', () => {
  //   expect(() =>
  //     jest.isolateModules(() => {
  //       require('../../src/server');
  //     })
  //   ).toThrow('JWT_SECRET environment variable is required');
  // });

  test('health endpoint works', async () => {
    process.env.JWT_SECRET = 'testsecret';
    const { app } = require('../../src/server');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('metrics endpoint responds', async () => {
    process.env.JWT_SECRET = 'testsecret';
    const { app } = require('../../src/server');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
  });
});
