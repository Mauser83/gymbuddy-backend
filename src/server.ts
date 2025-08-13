import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { PrismaClient } from "./lib/prisma";
import { PermissionService } from "./modules/core/permission.service";
import { DIContainer } from "./modules/core/di.container";
import { MediaService } from "./modules/media/media.service";
import { ImageIntakeService } from "./modules/images/image-intake.service";

import { errorHandler } from "./middlewares/errorHandler";
import { errorLogger, requestLogger } from "./middlewares/logger";
import { metricsMiddleware } from "./middlewares/metrics";
import { sanitizeInput } from "./middlewares/sanitization";
import { conditionalCsrf, csrfTokenRoute } from "./middlewares/csrf";

import { setupApollo } from "./graphql/setupApollo";
import { setupWebSocket } from "./graphql/setupWebsocket";
import apiRouter from "./api/apiRouter";

export const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Allow web from localhost for Expo web
      if (
        origin === "http://localhost:8081" ||
        origin === "http://localhost:19006"
        // add more as needed
      ) {
        return callback(null, true);
      }
      // Otherwise, block it
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.set("trust proxy", true);
export const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 4000;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// === API Routes ===
app.use("/api", apiRouter);

// === Security + Middlewares ===
app.use(cookieParser(JWT_SECRET));
if (process.env.NODE_ENV === "production") {
  app.use(conditionalCsrf);
  app.get("/csrf-token", csrfTokenRoute);
}
app.use(sanitizeInput);
app.use(express.json());
app.use(metricsMiddleware);
app.use(requestLogger);

// === DI Container Services ===
const container = DIContainer.getInstance();
const prisma = container.resolve<PrismaClient>("PrismaClient");
const permissionService =
  container.resolve<PermissionService>("PermissionService");
const mediaService = container.resolve<MediaService>("MediaService");
const imageIntakeService = new ImageIntakeService(prisma);

// === Health & Metrics ===
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", "text/plain");
    res.end(await require("prom-client").register.metrics());
  } catch {
    res.status(500).end("Error collecting metrics");
  }
});

// === Start Server ===
async function startApolloServer() {
  console.log("Starting Apollo Server...");
  await setupApollo(app, prisma, permissionService, mediaService, imageIntakeService);
  console.log("Apollo ready.");

  const httpServer = http.createServer(app);

  setupWebSocket(httpServer, prisma, permissionService, mediaService, imageIntakeService);

  httpServer.listen(PORT, () => {
    type Stage = "development" | "staging" | "production";
    const stage = (process.env.APP_ENV ?? "production").toLowerCase() as Stage;
    console.log(`running on ${stage} stage`);

    console.log("DB host:", new URL(process.env.DATABASE_URL!).host);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("🔻 Shutting down...");
    httpServer.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

app.use(errorLogger);
app.use(errorHandler);

// === Boot (skip for tests) ===
if (process.env.NODE_ENV !== "test") {
  startApolloServer().catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });
}
