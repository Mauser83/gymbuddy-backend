import { verifyRoles } from '../auth/auth.roles';
import { AuthContext } from '../auth/auth.types';

type ImageWorkerModule = typeof import('../images/image-worker.js');

let isRunning = false;
let loadImageWorker: () => Promise<ImageWorkerModule> = () =>
  import('../images/image-worker.js');

export const __setImageWorkerLoader = (loader?: typeof loadImageWorker) => {
  loadImageWorker = loader ?? (() => import('../images/image-worker.js'));
};

export const __resetImageWorkerState = () => {
  isRunning = false;
  __setImageWorkerLoader();
};

export const WorkerResolvers = {
  Mutation: {
    runImageWorkerOnce: async (_p: unknown, args: { max?: number }, ctx: AuthContext) => {
      verifyRoles(ctx, {
        or: [{ requireAppRole: 'ADMIN' }, { requireAppRole: 'MODERATOR' }],
      });

      const max = Math.max(1, Math.min(1000, Number(args?.max ?? 100)));

      if (isRunning) {
        return { ok: true, status: 'already-running' };
      }

      isRunning = true;
      setImmediate(async () => {
        try {
          const { runOnce } = await loadImageWorker();
          await runOnce(max);
        } catch (err) {
          console.error('[image-worker] runOnce error:', err);
        } finally {
          isRunning = false;
        }
      });

      return { ok: true, status: 'started' };
    },
  },
};