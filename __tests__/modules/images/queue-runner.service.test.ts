jest.mock('../../../src/prisma', () => ({
  ImageJobStatus: {
    succeeded: 'succeeded',
    pending: 'pending',
  },
}));

import { QueueRunnerService } from '../../../src/modules/images/queue-runner.service';
import { ImageJobStatus } from '../../../src/prisma';

describe('QueueRunnerService', () => {
  const queryMock = jest.fn();
  const executeMock = jest.fn();
  const updateMock = jest.fn();
  const prisma = {
    $queryRawUnsafe: queryMock,
    $executeRawUnsafe: executeMock,
    imageQueue: { update: updateMock },
  } as any;
  const service = new QueueRunnerService(prisma);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acquires lease when insert returns rows', async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const acquired = await service.tryAcquireLease('worker-1', 1234);
    expect(acquired).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), 'image-runner', 'worker-1', '1234');
  });

  it('fails to acquire lease when no rows returned', async () => {
    queryMock.mockResolvedValueOnce([]);
    const acquired = await service.tryAcquireLease('worker-2');
    expect(acquired).toBe(false);
  });

  it('renews lease when update count is positive', async () => {
    executeMock.mockResolvedValueOnce(1);
    const renewed = await service.renewLease('worker-3', 5000);
    expect(renewed).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(
      expect.any(String),
      'image-runner',
      'worker-3',
      '5000',
    );
  });

  it('returns false when renew lease does not update rows', async () => {
    executeMock.mockResolvedValueOnce(0);
    const renewed = await service.renewLease('worker-3');
    expect(renewed).toBe(false);
  });

  it('releases lease using delete statement', async () => {
    executeMock.mockResolvedValueOnce(undefined);
    await service.releaseLease('worker-4');
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "WorkerLease"'),
      'image-runner',
      'worker-4',
    );
  });

  it('claims a batch of jobs via query', async () => {
    const jobs = [{ id: '1' }] as any;
    queryMock.mockResolvedValueOnce(jobs);
    const result = await service.claimBatch(10);
    expect(result).toBe(jobs);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), 10);
  });

  it('marks jobs done with succeeded status', async () => {
    await service.markDone('job-1');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: ImageJobStatus.succeeded,
        finishedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it('marks jobs failed and schedules retry', async () => {
    await service.markFailed('job-2', new Error('boom'), 30);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: {
        status: ImageJobStatus.pending,
        lastError: expect.stringContaining('boom'),
        scheduledAt: new Date('2024-01-01T00:00:30.000Z'),
        startedAt: null,
        finishedAt: null,
      },
    });
  });

  it('serializes unknown errors when marking failed', async () => {
    await service.markFailed('job-3', { message: 'not-an-error' }, 10);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'job-3' },
      data: expect.objectContaining({
        lastError: '[object Object]',
      }),
    });
  });
});
