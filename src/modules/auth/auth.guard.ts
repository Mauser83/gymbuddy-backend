import { Request } from "express";
import jwt from "jsonwebtoken";
import { GraphQLError } from "graphql";
import { JWT_SECRET } from "../../server";
import { DIContainer } from "../core/di.container";
import { AuditService } from "../core/audit.service";
import { prisma } from "../../lib/prisma";
import { AppRole, UserRole, GymRole, AuthContext } from "./auth.types";

export const graphqlAuth = async ({
  req,
}: {
  req: Request;
}): Promise<Partial<AuthContext>> => {
  const container = DIContainer.getInstance();
  const auditService = container.resolve<AuditService>("AuditService");

  const operationName = req.body?.operationName;
  const query = req.body?.query;

  // Allow unauthenticated for introspection/login/register
  if (
    operationName === "Login" ||
    operationName === "Register" ||
    query?.includes("IntrospectionQuery")
  ) {
    return {
      userId: null,
      appRole: undefined,
      userRole: UserRole.USER,
      gymRoles: [],
      isPremium: false,
    };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("Authorization header missing");
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as {
      sub: string;
      appRole?: AppRole;
      userRole: UserRole;
      gymRoles: { gymId: number; role: GymRole }[];
      isPremium: boolean;
      tokenVersion: number;
    };

    const userId = parseInt(decoded.sub, 10);
    if (isNaN(userId)) {
      throw new Error("Invalid user ID in token.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      throw new GraphQLError("Token invalidated. Please log in again.", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    await auditService.logUserLogin(userId, req.ip || "unknown");

    return {
      userId,
      appRole: decoded.appRole,
      userRole: decoded.userRole,
      gymRoles: decoded.gymRoles || [],
      isPremium: decoded.isPremium || false,
    };
  } catch (err) {
    await auditService.logEvent({
      action: "LOGIN_FAILURE",
      metadata: {
        error: err instanceof Error ? err.message : "Unknown error",
        ip: req.ip,
      },
    });
    throw new Error("Invalid or expired token");
  }
};
