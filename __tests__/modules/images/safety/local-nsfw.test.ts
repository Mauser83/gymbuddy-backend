import type { SafetyResult } from '../../../../src/modules/images/safety/provider';

type EnsureModelFileModule = typeof import('../../../../src/modules/images/models.ensure');

type OnnxMockModule = typeof import('onnxruntime-node') & {
  __setSession: (session: any) => void;
  __getRunMock: () => jest.Mock;
};

type SharpMockModule = typeof import('sharp') & {
  __setBufferResult: (res: {
    data: Buffer;
    info: { width: number; height: number; channels: number };
  }) => void;
  __chain: SharpChain;
};

type SharpChain = {
  removeAlpha: jest.Mock<SharpChain, []>;
  resize: jest.Mock<SharpChain, []>;
  raw: jest.Mock<SharpChain, []>;
  toBuffer: jest.Mock<Promise<SharpBufferResult>, []>;
};

const ensureModelFileMock: jest.Mock = jest.fn();
let currentSession: any;
const runMock = jest.fn();

class MockTensor {
  type: string;
  data: Float32Array;
  dims: readonly number[];

  constructor(type: string, data: Float32Array, dims: readonly number[]) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

type SharpBufferResult = {
  data: Buffer;
  info: { width: number; height: number; channels: number };
};
let sharpBufferResult: SharpBufferResult | null = null;

jest.mock(
  '../../../../src/modules/images/models.ensure',
  (): EnsureModelFileModule =>
    ({
      ensureModelFile: ensureModelFileMock,
    }) as unknown as EnsureModelFileModule,
);

jest.mock('onnxruntime-node', () => ({
  InferenceSession: {
    create: jest.fn(async () => {
      if (!currentSession) {
        throw new Error('session not configured');
      }
      return currentSession;
    }),
  },
  Tensor: MockTensor,
  __setSession: (session: any) => {
    currentSession = session;
  },
  __getRunMock: () => runMock,
}));

function createSharpChain(): SharpChain {
  const chain: SharpChain = {
    removeAlpha: jest.fn<SharpChain, []>(() => chain),
    resize: jest.fn<SharpChain, []>(() => chain),
    raw: jest.fn<SharpChain, []>(() => chain),
    toBuffer: jest.fn<Promise<SharpBufferResult>, []>(async () => {
      if (!sharpBufferResult) {
        throw new Error('sharp buffer result not configured');
      }
      return sharpBufferResult;
    }),
  };
  return chain;
}

const sharpChain = createSharpChain();
const sharpFactoryMock: jest.Mock<SharpChain, []> = jest.fn<SharpChain, []>(() => sharpChain);

type SharpMock = jest.Mock & SharpMockModule;

const sharpMock = Object.assign(sharpFactoryMock, {
  __setBufferResult: (res: SharpBufferResult) => {
    sharpBufferResult = res;
  },
  __chain: sharpChain,
}) as SharpMock;

jest.mock('sharp', () => sharpMock);

const envKeys = [
  'SAFETY_PREPROC',
  'SAFETY_COLOR',
  'SAFETY_OUTPUT_LABELS',
  'SAFETY_NSFW_CLASSES',
  'SAFETY_MODEL_URL',
  'SAFETY_MODEL_R2_KEY',
  'SAFETY_MODEL_SHA256',
  'SAFETY_MODEL_PATH',
  'R2_BUCKET',
] as const;

const originalEnv: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

beforeAll(() => {
  for (const key of envKeys) {
    originalEnv[key] = process.env[key];
  }
});

const ortMock = require('onnxruntime-node') as OnnxMockModule;
const sharpModule = require('sharp') as SharpMock;
const ensureModule =
  require('../../../../src/modules/images/models.ensure') as EnsureModelFileModule;

const SIZE = 224;

function createUniformBuffer(r: number, g: number, b: number): Buffer {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const idx = i * 3;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
  }
  return buf;
}

function instantiateLocalNSFW(modelPath?: string) {
  let instance: any;
  jest.isolateModules(() => {
    const { LocalNSFW } = require('../../../../src/modules/images/safety/local-nsfw');
    instance = new LocalNSFW(modelPath);
  });
  return instance;
}

beforeEach(() => {
  ensureModelFileMock.mockReset();
  ensureModelFileMock.mockResolvedValue(undefined);
  runMock.mockReset();
  sharpBufferResult = null;
  sharpModule.__chain.removeAlpha.mockClear();
  sharpModule.__chain.resize.mockClear();
  sharpModule.__chain.raw.mockClear();
  sharpModule.__chain.toBuffer.mockClear();
  sharpModule.mockClear();
  ortMock.__setSession(null);
  for (const key of envKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of envKeys) {
    const val = originalEnv[key];
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
});

function expectClose(a: number, b: number) {
  expect(a).toBeCloseTo(b, 5);
}

describe('LocalNSFW', () => {
  it('uses NCHW preprocessing with VGG normalization and two-class fallback', async () => {
    process.env.SAFETY_PREPROC = 'vgg';
    process.env.SAFETY_COLOR = 'bgr';
    process.env.SAFETY_OUTPUT_LABELS = '';
    process.env.SAFETY_MODEL_URL = 'https://example.com/model.onnx';

    const logits = [0.2, 1.2];
    runMock.mockResolvedValue({
      output: { data: Float32Array.from(logits) },
    });

    const session = {
      inputNames: ['input'],
      inputMetadata: { input: { dimensions: [1, 3, SIZE, SIZE] } },
      outputNames: ['output'],
      run: runMock,
    };
    ortMock.__setSession(session);

    sharpModule.__setBufferResult({
      data: createUniformBuffer(10, 20, 30),
      info: { width: SIZE, height: SIZE, channels: 3 },
    });

    const instance = instantiateLocalNSFW('/tmp/custom.onnx');
    const result: SafetyResult = await instance.check(new Uint8Array([1, 2, 3]));

    expect(ensureModule.ensureModelFile).toHaveBeenCalledWith(
      '/tmp/custom.onnx',
      { kind: 'url', url: 'https://example.com/model.onnx' },
      undefined,
    );
    expect(runMock).toHaveBeenCalledTimes(1);
    const inputs = runMock.mock.calls[0][0];
    const tensor = inputs.input as MockTensor;
    expect(tensor.dims).toEqual([1, 3, SIZE, SIZE]);

    const data = tensor.data;
    expectClose(data[0], 30 - 104);
    expectClose(data[SIZE * SIZE], 20 - 117);
    expectClose(data[2 * SIZE * SIZE], 10 - 123);

    const max = Math.max(...logits);
    const exps = logits.map((x) => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const expectedScore = exps[1] / sum;

    expectClose(result.nsfwScore, expectedScore);
    expect(result.isSafe).toBe(expectedScore < 0.5);
    expect(result.hasPerson).toBeNull();
  });

  it('handles NHWC tensors with label-driven aggregation', async () => {
    process.env.SAFETY_PREPROC = 'imagenet';
    process.env.SAFETY_OUTPUT_LABELS = 'sfw,nsfw,neutral';
    process.env.SAFETY_NSFW_CLASSES = 'nsfw,sexy';
    process.env.SAFETY_MODEL_URL = 'https://example.com/model.onnx';

    const logits = [2, 1, 0];
    runMock.mockResolvedValue({
      output: { data: Float32Array.from(logits) },
    });

    const session = {
      inputNames: ['input'],
      inputMetadata: { input: { dimensions: [1, SIZE, SIZE, 3] } },
      outputNames: ['output'],
      run: runMock,
    };
    ortMock.__setSession(session);

    sharpModule.__setBufferResult({
      data: createUniformBuffer(10, 20, 30),
      info: { width: SIZE, height: SIZE, channels: 3 },
    });

    const instance = instantiateLocalNSFW('/tmp/model.onnx');
    const result: SafetyResult = await instance.check(new Uint8Array([9, 9, 9]));

    const tensor = runMock.mock.calls[0][0].input as MockTensor;
    expect(tensor.dims).toEqual([1, SIZE, SIZE, 3]);

    const data = tensor.data;
    const r = (10 / 255 - 0.485) / 0.229;
    const g = (20 / 255 - 0.456) / 0.224;
    const b = (30 / 255 - 0.406) / 0.225;
    expectClose(data[0], r);
    expectClose(data[1], g);
    expectClose(data[2], b);

    const max = Math.max(...logits);
    const exps = logits.map((x) => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((x) => x / sum);
    const expectedScore = probs[1];

    expectClose(result.nsfwScore, expectedScore);
    expect(result.isSafe).toBe(true);
    expect(result.hasPerson).toBeNull();
  });

  it('supports R2-backed models and single-logit outputs', async () => {
    process.env.SAFETY_PREPROC = 'vgg';
    process.env.SAFETY_COLOR = 'rgb';
    process.env.SAFETY_MODEL_PATH = '/opt/nsfw.onnx';
    process.env.SAFETY_MODEL_R2_KEY = 'nsfw-model.onnx';
    process.env.SAFETY_MODEL_SHA256 = 'deadbeef';
    process.env.R2_BUCKET = 'bucket-id';

    runMock.mockResolvedValue({
      score: { data: Float32Array.from([1.5]) },
    });

    const session = {
      inputNames: [],
      inputMetadata: undefined,
      outputNames: [],
      run: runMock,
    };
    ortMock.__setSession(session);

    sharpModule.__setBufferResult({
      data: createUniformBuffer(10, 20, 30),
      info: { width: SIZE, height: SIZE, channels: 3 },
    });

    const instance = instantiateLocalNSFW();
    const result: SafetyResult = await instance.check(new Uint8Array([5, 4, 3]));

    expect(ensureModule.ensureModelFile).toHaveBeenCalledWith(
      '/opt/nsfw.onnx',
      { kind: 'r2', bucket: 'bucket-id', key: 'nsfw-model.onnx' },
      'deadbeef',
    );

    const tensor = runMock.mock.calls[0][0].input as MockTensor;
    expect(tensor.dims).toEqual([1, SIZE, SIZE, 3]);
    const data = tensor.data;
    expectClose(data[0], 10 - 104);
    expectClose(data[1], 20 - 117);
    expectClose(data[2], 30 - 123);

    expect(result.nsfwScore).toBe(1);
    expect(result.isSafe).toBe(false);
    expect(result.hasPerson).toBeNull();
  });
});
