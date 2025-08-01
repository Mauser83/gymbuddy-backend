// src/middlewares/csrf.ts
import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

export const conditionalCsrf = (req: Request, res: Response, next: NextFunction) => {
  if (
    req.method === 'GET' ||
    req.path === '/graphql' ||
    process.env.DISABLE_CSRF === 'true' ||
    process.env.NODE_ENV !== 'production'
  ) {
    return next();
  }
  csrfProtection(req, res, next);
};

export const csrfTokenRoute = (req: Request, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
};
