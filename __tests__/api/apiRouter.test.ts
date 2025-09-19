import express, { json } from 'express';
import request from 'supertest';

import apiRouter from '../../src/api/apiRouter';

describe('apiRouter', () => {
  const app = express();
  app.use(json());
  app.use('/api', apiRouter);

  beforeEach(() => {
    jest.resetAllMocks();
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
});
