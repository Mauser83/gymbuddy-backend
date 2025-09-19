import { Request, Response } from 'express';
import { sanitizeInput } from '../../src/middlewares/sanitization';
import { errorHandler } from '../../src/middlewares/errorHandler';
import { GraphQLError } from 'graphql';

describe('middlewares', () => {
  test('sanitizeInput cleans strings', () => {
    const req = { body: { a: '<script>' }, query: {}, params: {} } as unknown as Request;
    sanitizeInput(req, {} as Response, () => {});
    expect(req.body.a).not.toContain('<script>');
  });

  test('errorHandler sends GraphQL errors as 400', () => {
    const err = new GraphQLError('bad');
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as any;
    errorHandler(err, { path: '/' } as Request, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalled();
  });

  test('errorHandler sends generic errors as 500', () => {
    const err = new Error('oops');
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as any;
    errorHandler(err, { path: '/' } as Request, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
