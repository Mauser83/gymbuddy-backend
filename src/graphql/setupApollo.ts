import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import typeDefs from "./rootSchema";
import resolvers from "./rootResolvers";
import { graphqlAuth } from "../modules/auth/auth.guard";
import type { AuthContext, UserRole } from "../modules/auth/auth.types";
import { PermissionService } from "../modules/core/permission.service";
import { PrismaClient } from "../lib/prisma";
import { MediaService } from "../modules/media/media.service";

export async function setupApollo(
  app: any,
  prisma: PrismaClient,
  permissionService: PermissionService,
  mediaService: MediaService
) {
  const apolloServer = new ApolloServer<AuthContext>({ typeDefs, resolvers });
  await apolloServer.start();

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }): Promise<AuthContext> => {
        const authContext = await graphqlAuth({ req });

        return {
          userId: authContext.userId ?? null,
          appRole: authContext.appRole,
          userRole: authContext.userRole as UserRole,
          gymRoles: authContext.gymRoles || [],
          isPremium: authContext.isPremium ?? false,
          prisma,
          permissionService,
          mediaService,
        };
      },
    })
  );
}
