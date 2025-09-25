import express, { json } from 'express';
import request from 'supertest';

import apiRouter from '../../src/api/apiRouter';

describe('apiRouter', () => {
  const app = express();
  app.use(json());
  app.use('/api', apiRouter);

  const originalFetch = global.fetch;
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch as any;
  });

  afterAll(() => {
    global.fetch = originalFetch as any;
    errorSpy.mockRestore();
  });

  test('GET /autocomplete returns 400 when input missing', async () => {
    const res = await request(app).get('/api/autocomplete');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/input/);
  });

  test('GET /autocomplete proxies success', async () => {
    const fakeData = { predictions: [] };
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(fakeData) }) as any;
    const res = await request(app).get('/api/autocomplete?input=test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeData);
  });

  test('GET /autocomplete handles fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail')) as any;
    const res = await request(app).get('/api/autocomplete?input=test');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/autocomplete/);
  });

  test('GET /autocomplete forwards non-ok responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 418,
      text: jest.fn().mockResolvedValue('teapot'),
    }) as any;

    const res = await request(app).get('/api/autocomplete?input=brew');
    expect(res.status).toBe(418);
    expect(res.text).toBe('teapot');
  });

  test('GET /place-details returns 400 when place_id missing', async () => {
    const res = await request(app).get('/api/place-details');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/place_id/);
  });

  test('GET /place-details proxies success', async () => {
    const fake = { result: {} };
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(fake) }) as any;
    const res = await request(app).get('/api/place-details?place_id=123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(fake);
  });

  test('GET /place-details handles fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fail')) as any;
    const res = await request(app).get('/api/place-details?place_id=1');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/place details/);
  });

  test('GET /place-details forwards non-ok responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('not found'),
    }) as any;

    const res = await request(app).get('/api/place-details?place_id=missing');
    expect(res.status).toBe(404);
    expect(res.text).toBe('not found');
  });

  test('POST /autocomplete validates payload input', async () => {
    const res = await request(app).post('/api/autocomplete').send({ input: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/input/);
  });

  test('POST /autocomplete proxies success responses', async () => {
    const payload = { suggestions: [] };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }) as any;

    const res = await request(app).post('/api/autocomplete').send({ input: 'gym' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
  });

  test('POST /autocomplete forwards upstream errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue('bad gateway'),
    }) as any;

    const res = await request(app).post('/api/autocomplete').send({ input: 'oops' });
    expect(res.status).toBe(502);
    expect(res.text).toBe('bad gateway');
  });

  test('POST /autocomplete handles fetch failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const res = await request(app).post('/api/autocomplete').send({ input: 'fail' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/autocomplete/);
  });
});
