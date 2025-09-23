import { GraphQLError } from 'graphql';

import { errorHandler } from '../../src/middlewares/errorHandler';

const buildRes = () => {
  const json = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json,
  } as any;

  return { res, json };
};

describe('errorHandler middleware', () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  test('delegates GraphQL path errors to next handler', () => {
    const err = new Error('boom');
    const next = jest.fn();
    const { res } = buildRes();

    errorHandler(err, { path: '/graphql' } as any, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('formats GraphQLError responses for REST requests', () => {
    const gqlError = new GraphQLError('bad', { extensions: { code: 'BAD_INPUT' } });
    const { res, json } = buildRes();

    errorHandler(gqlError, { path: '/api' } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      errors: [
        {
          message: 'bad',
          extensions: { code: 'BAD_INPUT' },
        },
      ],
    });
  });

  test('falls back to 500 for generic errors', () => {
    const err = new Error('terrible');
    const { res, json } = buildRes();

    errorHandler(err, { path: '/api' } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'terrible',
    });
  });
});