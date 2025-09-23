import { QueueService } from '../../../src/modules/cv/queue.service';
import { EnqueueImageJobDto, UpdateImageJobStatusDto } from '../../../src/modules/cv/queue.dto';
import { validateInput } from '../../../src/middlewares/validation';
import { kickBurstRunner } from '../../../src/modules/images/image-worker.js';

jest.mock('../../../src/middlewares/validation', () => ({
  validateInput: jest.fn(),
}));

jest.mock('../../../src/modules/images/image-worker.js', () => ({
  kickBurstRunner: jest.fn(),
}));

type PrismaMock = {
  imageQueue: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

const validateInputMock = validateInput as jest.MockedFunction<typeof validateInput>;
const kickBurstRunnerMock = kickBurstRunner as jest.MockedFunction<typeof kickBurstRunner>;

function createPrismaMock(): PrismaMock {
  return {
    imageQueue: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('QueueService', () => {
  let prisma: PrismaMock;
  let service: QueueService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new QueueService(prisma as any);
    validateInputMock.mockReset();
    kickBurstRunnerMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches a job by id', async () => {
    const record = { id: 'job-1' };
    prisma.imageQueue.findUnique.mockResolvedValue(record);

    const result = await service.getById('job-1');

    expect(prisma.imageQueue.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });
    expect(result).toBe(record);
  });

  it('lists active jobs with status filter and clamps limit', async () => {
    const rows = [{ id: 'job-2' }];
    prisma.imageQueue.findMany.mockResolvedValue(rows);

    const result = await service.list('PROCESSING', 500);

    expect(prisma.imageQueue.findMany).toHaveBeenCalledWith({
      where: { finishedAt: null, status: 'PROCESSING' as any },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    expect(result).toBe(rows);
  });

  it('lists active jobs with default limit when no status provided', async () => {
    const rows = [{ id: 'job-3' }];
    prisma.imageQueue.findMany.mockResolvedValue(rows);

    const result = await service.list(undefined, undefined);

    expect(prisma.imageQueue.findMany).toHaveBeenCalledWith({
      where: { finishedAt: null },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });
    expect(result).toBe(rows);
  });

  it('enqueues a job and triggers the burst runner', async () => {
    jest.useFakeTimers();

    const payload: EnqueueImageJobDto = {
      imageId: 'img-1',
      jobType: 'EMBED' as any,
      priority: 5,
      scheduledAt: new Date('2024-01-01T10:00:00.000Z') as any,
    };

    const created = { id: 'job-4', scheduledAt: new Date('2024-01-01T10:00:00.000Z') };
    prisma.imageQueue.create.mockResolvedValue(created);
    validateInputMock.mockResolvedValue(undefined);
    kickBurstRunnerMock.mockResolvedValue(undefined);

    const result = await service.enqueue(payload);

    expect(validateInputMock).toHaveBeenCalledWith(payload, EnqueueImageJobDto);
    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: {
        imageId: 'img-1',
        jobType: payload.jobType,
        priority: 5,
        scheduledAt: new Date('2024-01-01T10:00:00.000Z'),
      },
    });
    expect(result).toBe(created);

    await Promise.resolve();
    jest.runAllTimers();

    expect(kickBurstRunnerMock).toHaveBeenCalledTimes(1);
  });

  it('enqueues a job with defaults when optional fields omitted', async () => {
    jest.useFakeTimers();

    const payload = { imageId: 'img-2', jobType: 'PROMOTE' as any } as EnqueueImageJobDto;
    const created = { id: 'job-5' };
    prisma.imageQueue.create.mockResolvedValue(created);
    validateInputMock.mockResolvedValue(undefined);
    kickBurstRunnerMock.mockResolvedValue(undefined);

    const result = await service.enqueue(payload);

    expect(prisma.imageQueue.create).toHaveBeenCalledWith({
      data: {
        imageId: 'img-2',
        jobType: payload.jobType,
        priority: 0,
        scheduledAt: undefined,
      },
    });
    expect(result).toBe(created);

    await Promise.resolve();
    jest.runAllTimers();

    expect(kickBurstRunnerMock).toHaveBeenCalledTimes(1);
  });

  it('updates job status with normalized payload', async () => {
    const payload: UpdateImageJobStatusDto = {
      id: 'job-6',
      status: 'FAILED' as any,
      lastError: undefined,
      attempts: 3,
      startedAt: new Date('2024-01-02T00:00:00.000Z') as any,
      finishedAt: undefined,
    };
    const updated = { id: 'job-6', status: 'FAILED' };
    prisma.imageQueue.update.mockResolvedValue(updated);
    validateInputMock.mockResolvedValue(undefined);

    const result = await service.updateStatus(payload);

    expect(validateInputMock).toHaveBeenCalledWith(payload, UpdateImageJobStatusDto);
    expect(prisma.imageQueue.update).toHaveBeenCalledWith({
      where: { id: 'job-6' },
      data: {
        status: 'FAILED' as any,
        lastError: undefined,
        attempts: 3,
        startedAt: new Date('2024-01-02T00:00:00.000Z'),
        finishedAt: undefined,
      },
    });
    expect(result).toBe(updated);
  });

  it('deletes a job and returns true', async () => {
    prisma.imageQueue.delete.mockResolvedValue(undefined);

    const result = await service.delete('job-7');

    expect(prisma.imageQueue.delete).toHaveBeenCalledWith({ where: { id: 'job-7' } });
    expect(result).toBe(true);
  });
});