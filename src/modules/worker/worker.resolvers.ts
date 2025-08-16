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

      const lockedRow = await ctx.prisma.$queryRawUnsafe<{ locked: boolean }[]>(
        `SELECT pg_try_advisory_lock($1::int,$2::int) AS locked`,
        LOCK_A,
        LOCK_B
      );
      const locked = !!lockedRow?.[0]?.locked;
      if (!locked) return { ok: true, status: "already-running" };

      (async () => {
        try {
          await runOnce(max);
        } catch (err) {
          console.error("[image-worker] runOnce error:", err);
        } finally {
          try {
            await ctx.prisma.$executeRawUnsafe(
              `SELECT pg_advisory_unlock($1::int,$2::int)`,
              LOCK_A,
              LOCK_B
            );
          } catch (e) {
            console.error("[image-worker] unlock error:", e);
          }
        }
      })();

      return { ok: true, status: "started" };
    },
  },
};