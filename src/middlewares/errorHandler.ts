import { Request, Response, NextFunction } from 'express';
import { GraphQLError } from 'graphql';

export function errorHandler(
  err: Error | GraphQLError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err.stack);

  // For GraphQL requests, let Apollo Server handle the error
  if (req.path === '/graphql') {
    return next(err);
  }

  // For REST requests
  if (err instanceof GraphQLError) {
    return res.status(400).json({
      errors: [{
        message: err.message,
        extensions: err.extensions
      }]
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
}