import { runOnce } from "../images/image-worker";
import { verifyRoles } from "../auth/auth.roles";
import { AuthContext } from "../auth/auth.types";

const LOCK_A = 9142, LOCK_B = 1;

export const WorkerResolvers = {
  Mutation: {
    runImageWorkerOnce: async (
      _p: unknown,
      args: { max?: number },
      ctx: AuthContext
    ) => {
      verifyRoles(ctx, {
        or: [
          { requireAppRole: "ADMIN" },
          { requireAppRole: "MODERATOR" },
        ],
      });

      const max = Math.max(1, Math.min(1000, Number(args?.max ?? 100)));

      const result = await ctx.prisma.$transaction(async (tx) => {
        const lockedRow = await tx.$queryRawUnsafe<{ locked: boolean }[]>(
          `SELECT pg_try_advisory_xact_lock($1::int,$2::int) AS locked`,
          LOCK_A,
          LOCK_B
        );
        const locked = !!lockedRow?.[0]?.locked;
        if (!locked) return { ok: true, status: "already-running" };

        await runOnce(max);
        return { ok: true, status: "started" };
      });

      return result;
    },
  },
};