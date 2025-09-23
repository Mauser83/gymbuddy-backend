import { QueueRunnerService } from '../../../src/modules/images/queue-runner.service';
import { ImageJobStatus } from '../../../src/prisma';

describe('QueueRunnerService', () => {
  const basePrisma = () => ({
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    imageQueue: {
      update: jest.fn(),
    },
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('acquires and renews leases based on query results', async () => {
    const prisma = basePrisma();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ name: 'image-runner' }]);
    const runner = new QueueRunnerService(prisma as any);

    await expect(runner.tryAcquireLease('owner', 5000)).resolves.toBe(true);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "WorkerLease"'), 'image-runner', 'owner', '5000');

    prisma.$executeRawUnsafe.mockResolvedValueOnce(1);
    await expect(runner.renewLease('owner', 1000)).resolves.toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('UPDATE "WorkerLease"'), 'image-runner', 'owner', '1000');
  });

  it('returns false when lease cannot be acquired', async () => {
    const prisma = basePrisma();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
    const runner = new QueueRunnerService(prisma as any);
    await expect(runner.tryAcquireLease('owner', 123)).resolves.toBe(false);
  });

  it('releases leases with delete statement', async () => {
    const prisma = basePrisma();
    const runner = new QueueRunnerService(prisma as any);
    await runner.releaseLease('owner');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "WorkerLease"'),
      'image-runner',
      'owner',
    );
  });

  it('claims batches and returns queue jobs', async () => {
    const prisma = basePrisma();
    const runner = new QueueRunnerService(prisma as any);
    const jobs = [{ id: '1', jobType: 'HASH', storageKey: 'key', imageId: null, attempts: 1, priority: 0 }];
    prisma.$queryRawUnsafe.mockResolvedValueOnce(jobs);

    await expect(runner.claimBatch(5)).resolves.toEqual(jobs);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('WITH next AS'), 5);
  });

  it('marks jobs done with succeeded status', async () => {
    const prisma = basePrisma();
    const runner = new QueueRunnerService(prisma as any);
    await runner.markDone('job-1');
    expect(prisma.imageQueue.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: ImageJobStatus.succeeded,
        finishedAt: expect.any(Date),
        lastError: null,
      }),
    });
  });

  it('marks jobs failed with backoff scheduling', async () => {
    const prisma = basePrisma();
    const runner = new QueueRunnerService(prisma as any);
    await runner.markFailed('job-2', new Error('boom'), 30);
    expect(prisma.imageQueue.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: expect.objectContaining({
        status: ImageJobStatus.pending,
        scheduledAt: expect.any(Date),
        startedAt: null,
        finishedAt: null,
        lastError: expect.stringContaining('boom'),
      }),
    });
  });
});