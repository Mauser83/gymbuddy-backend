import { ImageJobStatus } from '../../generated/prisma';
import type { ImageQueue } from '../../generated/prisma';
import type { PrismaClient } from '../../lib/prisma';

export type QueueJob = Pick<
  ImageQueue,
  'id' | 'jobType' | 'storageKey' | 'imageId' | 'attempts' | 'priority'
>;

const RUNNER_NAME = 'image-runner';

export class QueueRunnerService {
  constructor(private prisma: PrismaClient) {}

  async tryAcquireLease(owner: string, ttlMs = 30_000) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO "WorkerLease"("name", "owner", "leaseUntil", "heartbeatAt")
      VALUES ($1, $2, NOW() + ($3::text || ' milliseconds')::interval, NOW())
      ON CONFLICT ("name")
      DO UPDATE SET
        "owner" = EXCLUDED."owner",
        "leaseUntil" = EXCLUDED."leaseUntil",
        "heartbeatAt" = EXCLUDED."heartbeatAt"
      WHERE "WorkerLease"."leaseUntil" <= NOW()
      RETURNING "name";
    `,
      RUNNER_NAME,
      owner,
      String(ttlMs),
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async renewLease(owner: string, ttlMs = 30_000) {
    const updated = await this.prisma.$executeRawUnsafe(
      `
      UPDATE "WorkerLease"
      SET "leaseUntil" = NOW() + ($3::text || ' milliseconds')::interval,
          "heartbeatAt" = NOW()
      WHERE "name" = $1 AND "owner" = $2 AND "leaseUntil" > NOW();
    `,
      RUNNER_NAME,
      owner,
      String(ttlMs),
    );
    return updated > 0;
  }

  async releaseLease(owner: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "WorkerLease" WHERE "name" = $1 AND "owner" = $2`,
      RUNNER_NAME,
      owner,
    );
  }

  async claimBatch(batchSize: number): Promise<QueueJob[]> {
    return this.prisma.$queryRawUnsafe<QueueJob[]>(
      `
      WITH next AS (
        SELECT "id"
        FROM "ImageQueue"
        WHERE "status" = 'pending'
          AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
        ORDER BY "priority" DESC, "createdAt" ASC
        LIMIT $1::int
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ImageQueue" q
      SET "status" = 'processing',
          "startedAt" = NOW(),
          "attempts" = "attempts" + 1
      FROM next
      WHERE q."id" = next."id"
      RETURNING q."id", q."jobType", q."storageKey", q."imageId", q."attempts", q."priority";
    `,
      batchSize,
    );
  }

  async markDone(id: string) {
    await this.prisma.imageQueue.update({
      where: { id },
      data: {
        status: ImageJobStatus.succeeded,
        finishedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markFailed(id: string, err: unknown, backoffSeconds = 60) {
    const msg =
      err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
    const next = new Date(Date.now() + backoffSeconds * 1000);
    await this.prisma.imageQueue.update({
      where: { id },
      data: {
        status: ImageJobStatus.pending,
        lastError: msg.slice(0, 3000),
        scheduledAt: next,
        startedAt: null,
        finishedAt: null,
      },
    });
  }
}
