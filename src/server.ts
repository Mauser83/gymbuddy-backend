import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from './lib/prisma';
import { PermissionService } from './modules/core/permission.service';
import { DIContainer } from './modules/core/di.container';

import { errorHandler } from './middlewares/errorHandler';
import { errorLogger, requestLogger } from './middlewares/logger';
import { metricsMiddleware } from './middlewares/metrics';
import { sanitizeInput } from './middlewares/sanitization';
import { conditionalCsrf, csrfTokenRoute } from './middlewares/csrf';

import { setupApollo } from './graphql/setupApollo';
import { setupWebSocket } from './graphql/setupWebsocket';
import apiRouter from './api/apiRouter';

export const app = express();
app.set('trust proxy', true);
export const JWT_SECRET = process.env.JWT_SECRET;
const GRAPHQL_PORT = process.env.GRAPHQL_PORT || 4000;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// === Security + Middlewares ===
app.use(cookieParser(JWT_SECRET));
if (process.env.NODE_ENV === 'production') {
  app.use(conditionalCsrf);
  app.get('/csrf-token', csrfTokenRoute);
}
app.use(sanitizeInput);
app.use(express.json());
app.use(metricsMiddleware);
app.use(requestLogger);


// CORS Config - allow all origins during development/testing
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// Helmet security headers
// - In production: allow Apollo Playground assets via a strict CSP
// - In other environments: disable CSP entirely for easier debugging
if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'cdn.jsdelivr.net',
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'fonts.googleapis.com',
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
          fontSrc: ["'self'", 'fonts.gstatic.com'],
          connectSrc: [
            "'self'",
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
          imgSrc: [
            "'self'",
            'apollo-server-landing-page.cdn.apollographql.com',
            'data:',
          ],
          manifestSrc: [
            "'self'",
            'apollo-server-landing-page.cdn.apollographql.com',
          ],
        },
      },
    })
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
}

// === Rate Limits ===
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// === DI Container Services ===
const container = DIContainer.getInstance();
const prisma = container.resolve<PrismaClient>('PrismaClient');
const permissionService = container.resolve<PermissionService>('PermissionService');

// === API Routes ===
app.use('/api', apiLimiter, apiRouter);

// === Health & Metrics ===
app.get('/health', healthLimiter, (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/metrics', healthLimiter, async (_req, res) => {
  try {
    res.set('Content-Type', 'text/plain');
    res.end(await require('prom-client').register.metrics());
  } catch {
    res.status(500).end('Error collecting metrics');
  }
});

// === Start Server ===
async function startApolloServer() {
  console.log('Starting Apollo Server...');
  await setupApollo(app, prisma, permissionService);
  console.log('Apollo ready.');

  const expressServer = app.listen(GRAPHQL_PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${GRAPHQL_PORT}/graphql`);
  });

  setupWebSocket(expressServer, prisma, permissionService);

  // Graceful shutdown
  const shutdown = () => {
    console.log('🔻 Shutting down...');
    expressServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

app.use(errorLogger);
app.use(errorHandler);

// === Boot (skip for tests) ===
if (process.env.NODE_ENV !== 'test') {
  startApolloServer().catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}
