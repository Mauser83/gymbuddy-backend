import { PrismaClient, ImageQueue } from "@prisma/client";

export type QueueJob = Pick<ImageQueue, "id" | "jobType" | "storageKey" | "imageId">;

export class QueueRunnerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Claim a small batch of due jobs in a race-safe way.
   * Flips status: pending → running and increments attempts.
   */
  async claimBatch(limit = 5): Promise<QueueJob[]> {
    const now = new Date();

    const candidates = await this.prisma.imageQueue.findMany({
      where: {
        status: "pending",
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      },
      orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }, { createdAt: "asc" }],
      take: limit * 3,
      select: { id: true },
    });

    const claimed: QueueJob[] = [];
    for (const c of candidates) {
      const updated = await this.prisma.imageQueue.updateMany({
        where: { id: c.id, status: "pending" },
        data: { status: "running", startedAt: now, attempts: { increment: 1 } },
      });
      if (updated.count === 1) {
        const job = await this.prisma.imageQueue.findUnique({ where: { id: c.id } });
        if (job) claimed.push(job as QueueJob);
      }
      if (claimed.length >= limit) break;
    }
    return claimed;
  }

  async markDone(id: string) {
    await this.prisma.imageQueue.update({
      where: { id },
      data: { status: "done", finishedAt: new Date(), lastError: null },
    });
  }

  async markFailed(id: string, err: unknown, backoffSeconds = 60) {
    const msg = err instanceof Error ? err.message : String(err);
    const next = new Date(Date.now() + backoffSeconds * 1000);
    await this.prisma.imageQueue.update({
      where: { id },
      data: {
        status: "pending",
        lastError: msg.slice(0, 500),
        scheduledAt: next,
        startedAt: null,
        finishedAt: null,
      },
    });
  }
}
