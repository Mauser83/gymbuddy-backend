import { useServer } from "graphql-ws/use/ws";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { GraphQLError } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "./rootSchema";
import resolvers from "./rootResolvers";
import { PrismaClient } from "../lib/prisma";
import { PermissionService } from "../modules/core/permission.service";
import { JWT_SECRET } from "../server";

export function setupWebSocket(
  server: any,
  prisma: PrismaClient,
  permissionService: PermissionService
) {
  const wsServer = new WebSocketServer({
    server,
    path: "/graphql",
    verifyClient: (info, done) => {
      const origin = info.origin;
      if (!origin) return done(false, 401, "Origin missing");
      if (origin.includes("localhost") || origin.includes("192.168."))
        return done(true);
      return done(false, 401, "Unauthorized origin");
    },
  });

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  useServer(
    {
      schema,
      context: async (ctx) => {
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
        };
      },
    },
    wsServer
  );
}
