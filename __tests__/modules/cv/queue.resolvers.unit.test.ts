import { validateInput } from '../../../src/middlewares/validation';
import { EnqueueImageJobDto, UpdateImageJobStatusDto } from '../../../src/modules/cv/queue.dto';
import { QueueResolvers } from '../../../src/modules/cv/queue.resolvers';
import { QueueService } from '../../../src/modules/cv/queue.service';

jest.mock('../../../src/middlewares/validation', () => ({
  validateInput: jest.fn(),
}));

jest.mock('../../../src/modules/cv/queue.service', () => ({
  QueueService: jest.fn(),
}));

const validateInputMock = validateInput as jest.MockedFunction<typeof validateInput>;
const QueueServiceMock = QueueService as unknown as jest.MockedClass<typeof QueueService>;

type QueueServiceShape = {
  getById: jest.Mock;
  list: jest.Mock;
  enqueue: jest.Mock;
  updateStatus: jest.Mock;
  delete: jest.Mock;
};

function createServiceMock(overrides: Partial<QueueServiceShape> = {}): QueueServiceShape {
  return {
    getById: jest.fn(),
    list: jest.fn(),
    enqueue: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

describe('QueueResolvers', () => {
  const prisma = Symbol('prisma');
  const context = { prisma } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    validateInputMock.mockResolvedValue(undefined);
  });

  it('returns storage key from ImageQueue type', () => {
    expect(QueueResolvers.ImageQueue.storageKey({ storageKey: 'abc' })).toBe('abc');
  });

  it('fetches a single job via the service', async () => {
    const serviceInstance = createServiceMock({
      getById: jest.fn().mockResolvedValue({ id: 'job-1' }),
    });
    QueueServiceMock.mockImplementation(() => serviceInstance as unknown as QueueService);

    const result = await QueueResolvers.Query.imageJob({}, { id: 'job-1' }, context);

    expect(QueueServiceMock).toHaveBeenCalledWith(prisma);
    expect(serviceInstance.getById).toHaveBeenCalledWith('job-1');
    expect(result).toEqual({ id: 'job-1' });
  });

  it('lists jobs with default limit', async () => {
    const serviceInstance = createServiceMock({
      list: jest.fn().mockResolvedValue([{ id: 'job-2' }]),
    });
    QueueServiceMock.mockImplementation(() => serviceInstance as unknown as QueueService);

    const result = await QueueResolvers.Query.imageJobs({}, {}, context);

    expect(serviceInstance.list).toHaveBeenCalledWith(undefined, 50);
    expect(result).toEqual([{ id: 'job-2' }]);
  });

  it('enqueues a job after validation', async () => {
    const payload = { imageId: 'img-1', jobType: 'EMBED' as any } as EnqueueImageJobDto;
    const serviceInstance = createServiceMock({
      enqueue: jest.fn().mockResolvedValue({ id: 'job-3' }),
    });
    QueueServiceMock.mockImplementation(() => serviceInstance as unknown as QueueService);

    const result = await QueueResolvers.Mutation.enqueueImageJob({}, { input: payload }, context);

    expect(validateInputMock).toHaveBeenCalledWith(payload, EnqueueImageJobDto);
    expect(serviceInstance.enqueue).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ id: 'job-3' });
  });

  it('updates job status after validation', async () => {
    const payload = { id: 'job-4', status: 'DONE' as any } as UpdateImageJobStatusDto;
    const serviceInstance = createServiceMock({
      updateStatus: jest.fn().mockResolvedValue({ id: 'job-4', status: 'DONE' }),
    });
    QueueServiceMock.mockImplementation(() => serviceInstance as unknown as QueueService);

    const result = await QueueResolvers.Mutation.updateImageJobStatus(
      {},
      { input: payload },
      context,
    );

    expect(validateInputMock).toHaveBeenCalledWith(payload, UpdateImageJobStatusDto);
    expect(serviceInstance.updateStatus).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ id: 'job-4', status: 'DONE' });
  });

  it('deletes a job via the service', async () => {
    const serviceInstance = createServiceMock({ delete: jest.fn().mockResolvedValue(true) });
    QueueServiceMock.mockImplementation(() => serviceInstance as unknown as QueueService);

    const result = await QueueResolvers.Mutation.deleteImageJob({}, { id: 'job-5' }, context);

    expect(serviceInstance.delete).toHaveBeenCalledWith('job-5');
    expect(result).toBe(true);
  });
});
