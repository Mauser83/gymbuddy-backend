import promBundle from 'express-prom-bundle';

// Type declarations
declare module 'express-prom-bundle' {
  interface Options {
    includeMethod?: boolean;
    includePath?: boolean;
    includeStatusCode?: boolean;
    includeUp?: boolean;
    customLabels?: Record<string, string>;
    promClient?: {
      collectDefaultMetrics?: {
        timeout?: number;
      };
    };
  }
}

// Create and export metrics middleware
export const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: {
    app: 'gymbuddy_backend',
    version: process.env.npm_package_version || 'unknown',
  },
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000,
    },
  },
});
