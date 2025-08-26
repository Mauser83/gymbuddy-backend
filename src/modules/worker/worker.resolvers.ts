import { verifyRoles } from "../auth/auth.roles";
import { AuthContext } from "../auth/auth.types";

let isRunning = false;

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

      if (isRunning) {
        return { ok: true, status: "already-running" };
      }

      isRunning = true;
      setImmediate(async () => {
        try {
          const { runOnce } = await import("../images/image-worker.js");
          await runOnce(max);
        } catch (err) {
          console.error("[image-worker] runOnce error:", err);
        } finally {
          isRunning = false;
        }
      });

      return { ok: true, status: "started" };
    },
  },
};