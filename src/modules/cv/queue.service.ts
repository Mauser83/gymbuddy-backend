import { EnqueueImageJobDto, UpdateImageJobStatusDto } from './queue.dto';
import { PrismaClient } from '../../lib/prisma';
import { validateInput } from '../../middlewares/validation';
import { kickBurstRunner } from '../images/image-worker';

export class QueueService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  getById(id: string) {
    return this.prisma.imageQueue.findUnique({ where: { id } });
  }

  list(status?: string, limit = 50) {
    return this.prisma.imageQueue.findMany({
      where: {
        finishedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(limit, 200),
    });
  }

  async enqueue(input: EnqueueImageJobDto) {
    await validateInput(input, EnqueueImageJobDto);
    const job = await this.prisma.imageQueue.create({
      data: {
        imageId: input.imageId,
        jobType: input.jobType,
        priority: input.priority ?? 0,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });
    setImmediate(() => {
      kickBurstRunner().catch((e) => console.error('burst runner error', e));
    });
    return job;
  }
  async updateStatus(input: UpdateImageJobStatusDto) {
    await validateInput(input, UpdateImageJobStatusDto);
    return this.prisma.imageQueue.update({
      where: { id: input.id },
      data: {
        status: input.status as any,
        lastError: input.lastError ?? undefined,
        attempts: input.attempts ?? undefined,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        finishedAt: input.finishedAt ? new Date(input.finishedAt) : undefined,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.imageQueue.delete({ where: { id } });
    return true;
  }
}
