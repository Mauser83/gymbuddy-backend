// Jest runtime mocks in this suite rely on manual type definitions for clarity.
import { jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';

const createMock = <Fn extends (...args: any[]) => any>(implementation?: Fn): MockedFunction<Fn> =>
  jest.fn(implementation) as unknown as MockedFunction<Fn>;

type SharpChain = {
  metadata: MockedFunction<() => Promise<{ width: number; height: number }>>;
  resize: MockedFunction<(size: { width: number; height: number }) => SharpChain>;
  extend: MockedFunction<(options: unknown) => SharpChain>;
  removeAlpha: MockedFunction<() => SharpChain>;
  raw: MockedFunction<(options?: unknown) => SharpChain>;
  toBuffer: MockedFunction<
    () => Promise<{
      data: Uint8Array;
      info: { width: number; height: number; channels: number };
    }>
  >;
};

const sharpMock = createMock<(input: Buffer | Uint8Array) => SharpChain>(() => {
  throw new Error('sharp mock not configured');
});

jest.mock('sharp', () => ({
  __esModule: true,
  default: sharpMock,
}));

const mockCreate = createMock<(path: string, options?: unknown) => Promise<any>>();

class MockTensor {
  constructor(
    public readonly type: string,
    public readonly data: Float32Array,
    public readonly dims: number[],
  ) {}
}

jest.mock('onnxruntime-node', () => ({
  Tensor: MockTensor,
  InferenceSession: {
    create: mockCreate,
  },
}));

const ensureModelFileMock =
  createMock<(key: string, client: unknown, destination?: string) => Promise<void>>();

jest.mock('../../../../src/modules/images/models.ensure', () => ({
  ensureModelFile: ensureModelFileMock,
}));

const originalEnv = { ...process.env };

describe('local person safety detector', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PERSON_MODEL_PATH: 'test-model.onnx',
      PERSON_INPUT_SIZE: '4',
      PERSON_CONF: '0.45',
      PERSON_OBJ_MIN: '0.25',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function configureSharp(dataValue = 120) {
    const size = Number(process.env.PERSON_INPUT_SIZE);
    const metadata = { width: size * 2, height: size }; // force resize branch
    const info = { width: size, height: size, channels: 3 };
    const data = Uint8Array.from({ length: size * size * 3 }, (_, i) => (dataValue + i) % 255);

    const metadataMock = createMock<() => Promise<{ width: number; height: number }>>();
    const resizeMock = createMock<(size: { width: number; height: number }) => SharpChain>();
    const extendMock = createMock<(options: unknown) => SharpChain>();
    const removeAlphaMock = createMock<() => SharpChain>();
    const rawMock = createMock<(options?: unknown) => SharpChain>();
    const toBufferMock = createMock<() => Promise<{ data: Uint8Array; info: typeof info }>>();

    const chain: SharpChain = {
      metadata: metadataMock,
      resize: resizeMock,
      extend: extendMock,
      removeAlpha: removeAlphaMock,
      raw: rawMock,
      toBuffer: toBufferMock,
    };

    metadataMock.mockResolvedValue(metadata);
    resizeMock.mockReturnValue(chain);
    extendMock.mockReturnValue(chain);
    removeAlphaMock.mockReturnValue(chain);
    rawMock.mockReturnValue(chain);
    toBufferMock.mockResolvedValue({ data, info });

    sharpMock.mockReturnValue(chain);
    return chain;
  }

  function loadModule() {
    return require('../../../../src/modules/images/safety/local-person');
  }

  it('detects a person from 85-value outputs', async () => {
    configureSharp();
    const logits = new Float32Array(85);
    logits[2] = 2; // width
    logits[3] = 4; // height
    logits[4] = 3; // obj logit → sigmoid ≈ 0.95
    logits[5] = 3; // class logit → sigmoid ≈ 0.95

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ preds: { data: Float32Array } }>>();
    run.mockResolvedValue({ preds: { data: logits } });

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([1, 2, 3]))).resolves.toBe(true);
    expect(session.run).toHaveBeenCalledTimes(1);
  });

  it('detects a person from NMS-style outputs', async () => {
    configureSharp();
    const outputs = new Float32Array([0, 0, 2, 4, 0.9, 0]);

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ nms: { data: Float32Array } }>>();
    run.mockResolvedValue({ nms: { data: outputs } });

    const session = {
      inputNames: ['images'],
      outputNames: ['nms'],
      outputMetadata: { nms: { dimensions: [1, 6] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([9, 8, 7]))).resolves.toBe(true);
  });

  it('ignores detections below the configured area threshold', async () => {
    configureSharp();
    const logits = new Float32Array(85);
    logits[2] = 0.1; // width (very small)
    logits[3] = 0.2; // height
    logits[4] = 0.8; // already probability
    logits[5] = 0.8;

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ preds: { data: Float32Array } }>>();
    run.mockResolvedValue({ preds: { data: logits } });

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([4, 5, 6]))).resolves.toBe(false);
  });

  it('rejects detections outside the supported aspect ratio bounds', async () => {
    configureSharp();
    const logits = new Float32Array(85);
    logits[2] = 0.5; // narrow width
    logits[3] = 10; // very tall height → aspect ratio >> ASP_MAX
    logits[4] = 4; // confident object logit
    logits[5] = 4; // confident class logit

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ preds: { data: Float32Array } }>>();
    run.mockResolvedValue({ preds: { data: logits } });

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([3, 2, 1]))).resolves.toBe(false);
  });

  it('reads tensor dims when metadata is unavailable', async () => {
    configureSharp();
    const logits = new Float32Array(85);
    logits[2] = 3;
    logits[3] = 3;
    logits[4] = 2; // sigmoid ≈ 0.88
    logits[5] = 2; // sigmoid ≈ 0.88

    const tensor = { data: logits, dims: [1, 3, 3, 85] } as any;
    const run = createMock<(feeds: Record<string, unknown>) => Promise<{ preds: typeof tensor }>>();
    run.mockResolvedValue({ preds: tensor });

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: {}, // force fallback to tensor.dims
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([6, 5, 4]))).resolves.toBe(true);
  });

  it('detects a person when NMS outputs include a batch column', async () => {
    configureSharp();
    const outputs = new Float32Array([0, 0, 2, 4, 0.95, 0, 0.42]);

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ nms: { data: Float32Array } }>>();
    run.mockResolvedValue({ nms: { data: outputs } });

    const session = {
      inputNames: ['images'],
      outputNames: ['nms'],
      outputMetadata: { nms: { dimensions: [1, 7] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([7, 7, 7]))).resolves.toBe(true);
  });

  it('returns false for unsupported output shapes', async () => {
    configureSharp();
    const weird = new Float32Array(10); // not divisible by 85 and not NMS shaped

    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ weird: { data: Float32Array } }>>();
    run.mockResolvedValue({ weird: { data: weird } });

    const session = {
      inputNames: ['images'],
      outputNames: ['weird'],
      outputMetadata: { weird: { dimensions: [1, 10] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([0, 1, 2]))).resolves.toBe(false);
  });

  it('downloads the model from R2 only once and reuses the cached session', async () => {
    process.env.PERSON_MODEL_R2_KEY = 'yolo.onnx';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ACCOUNT_ID = 'acct';

    configureSharp();
    const logits = new Float32Array(85);
    const run =
      createMock<(feeds: Record<string, unknown>) => Promise<{ preds: { data: Float32Array } }>>();
    run.mockResolvedValue({ preds: { data: logits } });

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run,
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await hasPerson(Buffer.from([1]));
    await hasPerson(Buffer.from([2]));

    expect(ensureModelFileMock).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(session.run).toHaveBeenCalledTimes(2);
  });
});
