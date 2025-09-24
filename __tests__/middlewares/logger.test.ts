import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';

const infoMock = jest.fn();
const errorMock = jest.fn();
const userFindUniqueMock = jest.fn();
const verifyMock = jest.fn();

jest.mock('../../src/prisma', () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: infoMock,
    error: errorMock,
  })),
  format: {
    json: jest.fn(() => 'json'),
  },
  transports: {
    Console: jest.fn(() => ({})),
    File: jest.fn(() => ({})),
  },
}));

jest.mock('jsonwebtoken', () => ({
  verify: verifyMock,
}));

import { requestLogger, errorLogger } from '../../src/middlewares/logger';

const waitForAsyncTasks = () => new Promise((resolve) => setImmediate(resolve));

describe('logger middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  const createResponse = () => {
    const res = new EventEmitter() as Response & { statusCode: number };
    res.statusCode = 200;
    return res;
  };

  test('logs graphql operations with resolved username', async () => {
    const req = {
      method: 'POST',
      originalUrl: '/graphql',
      headers: { authorization: 'Bearer token' },
      body: { operationName: 'MyOperation' },
    } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();

    verifyMock.mockReturnValue({ sub: '123' });
    userFindUniqueMock.mockResolvedValue({ username: 'jane' });

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    await waitForAsyncTasks();

    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/graphql',
        status: 200,
        operationName: 'MyOperation',
        user: 'jane',
      }),
    );
    expect(infoMock.mock.calls[0][0].duration).toMatch(/ms$/);
  });

  test('falls back to user id when username lookup fails and extracts operation from query', async () => {
    const req = {
      method: 'POST',
      originalUrl: '/graphql',
      headers: { authorization: 'Bearer token' },
      body: { query: 'mutation UpdatePlan { updateWorkoutPlan { id } }' },
    } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();

    verifyMock.mockReturnValue({ sub: '77' });
    userFindUniqueMock.mockRejectedValue(new Error('db failure'));

    requestLogger(req, res, next);

    res.emit('finish');
    await waitForAsyncTasks();

    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'UpdatePlan',
        user: 77,
      }),
    );
  });

  test('skips logging for OPTIONS requests', async () => {
    const req = {
      method: 'OPTIONS',
      originalUrl: '/health',
      headers: {},
    } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    await waitForAsyncTasks();

    expect(infoMock).not.toHaveBeenCalled();
  });

  test('errorLogger logs errors and forwards them', () => {
    const err = new Error('boom');
    const req = { method: 'GET', originalUrl: '/path' } as Request;
    const res = createResponse();
    const next = jest.fn() as NextFunction;

    errorLogger(err, req, res, next);

    expect(errorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'boom',
      }),
    );
    expect(next).toHaveBeenCalledWith(err);
  });
});
