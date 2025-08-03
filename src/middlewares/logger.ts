import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    void (async () => {
      let userIdentifier: string | number | undefined;

      const authHeader = req.headers.authorization;
      if (authHeader && process.env.JWT_SECRET) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
            sub: string;
          };
          const userId = parseInt(decoded.sub, 10);
          if (!isNaN(userId)) {
            try {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { username: true },
              });
              userIdentifier = user?.username ?? userId;
            } catch {
              userIdentifier = userId;
            }
          }
        } catch {
          // Ignore token errors for logging purposes
        }
      }

      let operationName: string | undefined;
      if (req.originalUrl === '/graphql') {
        operationName = req.body?.operationName;
        if (!operationName && typeof req.body?.query === 'string') {
          const match = req.body.query.match(/(mutation|query)\s+(\w+)/);
          operationName = match ? match[2] : undefined;
        }
      }

      logger.info({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        ...(operationName ? { operationName } : {}),
        ...(userIdentifier ? { user: userIdentifier } : {}),
      });
    })();
  });

  next();
}

export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  next(err);
}