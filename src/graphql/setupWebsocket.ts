import { useServer } from "graphql-ws/use/ws";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { GraphQLError } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "./rootSchema";
import resolvers from "./rootResolvers";
import { PrismaClient } from "../lib/prisma";
import { PermissionService } from "../modules/core/permission.service";
import { MediaService } from "../modules/media/media.service";
import { ImageIntakeService } from "../modules/images/image-intake.service";
import { ImagePromotionService } from "../modules/images/image-promotion.service";
import { ImageModerationService } from "../modules/images/image-moderation.service";
import { JWT_SECRET } from "../server";

export function setupWebSocket(
  server: any,
  prisma: PrismaClient,
  permissionService: PermissionService,
  mediaService: MediaService,
  imageIntakeService: ImageIntakeService,
  imagePromotionService: ImagePromotionService,
  imageModerationService: ImageModerationService
) {
  const wsServer = new WebSocketServer({
    server,
    path: "/graphql",
    verifyClient: (info, done) => {
      // console.log(`[WebSocket] Verification attempt from origin: ${info.origin}`);

      const origin = info.origin;

      if (!origin) {
        return done(true);
      }

      // ✅ **THE FIX:** Add your Render URL to this list.
      const allowedOrigins = [
        "https://gymbuddy-backend-i9je.onrender.com/",
        // You might also want your frontend's URL here for web clients
        // 'https://your-frontend-app.onrender.com'
      ];

      if (
        allowedOrigins.includes(origin) ||
        origin.includes("localhost") ||
        origin.includes("192.168.")
      ) {
        return done(true);
      }

      console.warn(
        `[WebSocket] Connection rejected for invalid origin: ${origin}`
      );
      return done(false, 401, "Unauthorized origin");
    },
  });

  wsServer.on("connection", () => {
    // console.log("WebSocket connection opened!");
  });

  wsServer.on("error", (err) => {
    console.error("WebSocket server error:", err);
  });

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  useServer(
    {
      schema,
      context: async (ctx) => {
        // console.log("WS connectionParams:", ctx.connectionParams);

        const token = (ctx.connectionParams?.authorization as string)?.replace(
          "Bearer ",
          ""
        );
        if (!token) {
          return {
            userId: null,
            appRole: undefined,
            userRole: "USER",
            gymRoles: [],
            isPremium: false,
            prisma,
            permissionService,
            mediaService,
            imageIntakeService,
            imagePromotionService,
            imageModerationService,
          };
        }

        if (!JWT_SECRET) throw new Error("JWT_SECRET is not defined");
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = parseInt(decoded.sub, 10);

        if (isNaN(userId)) {
          throw new Error("Invalid user ID from token.");
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { tokenVersion: true },
        });

        if (!user || user.tokenVersion !== decoded.tokenVersion) {
          throw new GraphQLError("Invalid or expired token", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        return {
          userId: userId,
          appRole: decoded.appRole,
          userRole: decoded.userRole,
          gymRoles: decoded.gymRoles || [],
          isPremium: decoded.isPremium || false,
          prisma,
          permissionService,
          mediaService,
          imageIntakeService,
          imagePromotionService,
          imageModerationService,
        };
      },
    },
    wsServer
  );
}
