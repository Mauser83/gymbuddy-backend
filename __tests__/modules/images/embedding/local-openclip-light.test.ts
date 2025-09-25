import type { OrtLogLevel } from '../../../../src/modules/images/embedding/local-openclip-light';

const ensureModelFileMock = jest.fn<Promise<void>, [string, unknown, string | undefined]>();

class MockTensor {
  type: string;
  data: unknown;
  dims: readonly number[];

  constructor(type: string, data: unknown, dims: readonly number[]) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

const runMock = jest.fn();
const sessionMock: any = {
  inputNames: ['pixel_values'],
  outputNames: ['image_embeds'],
  inputMetadata: { pixel_values: { dimensions: [1, 3, 224, 224] } },
  outputMetadata: { image_embeds: { dimensions: [1, 512] } },
  run: runMock,
};
const createMock = jest.fn<
  Promise<typeof sessionMock>,
  [string | Buffer, Record<string, unknown>?]
>(async () => sessionMock);

type ResizeCall = { width: number; height: number };
const sharpResizeCalls: ResizeCall[] = [];

type SharpPipeline = {
  rotate: jest.Mock<SharpPipeline, [unknown?]>;
  resize: jest.Mock<SharpPipeline, [number, number, unknown?]>;
  removeAlpha: jest.Mock<SharpPipeline, [unknown?]>;
  raw: jest.Mock<SharpPipeline, [unknown?]>;
  toBuffer: jest.Mock<Promise<Buffer>, []>;
  png: jest.Mock<SharpPipeline, [unknown?]>;
};

type SharpMock = jest.Mock<SharpPipeline, [unknown?, unknown?]> & {
  cache: jest.Mock;
  concurrency: jest.Mock;
  limitInputPixels: jest.Mock;
};

const cacheMock = jest.fn();
const concurrencyMock = jest.fn();
const limitInputPixelsMock = jest.fn();

const sharpFactory = jest.fn<SharpPipeline, [unknown?, unknown?]>(() => {
  let width = 0;
  let height = 0;

  const pipeline: SharpPipeline = {
    rotate: jest.fn<SharpPipeline, [unknown?]>(() => pipeline),
    resize: jest.fn<SharpPipeline, [number, number, unknown?]>((w: number, h: number) => {
      width = w;
      height = h;
      sharpResizeCalls.push({ width: w, height: h });
      return pipeline;
    }),
    removeAlpha: jest.fn<SharpPipeline, [unknown?]>(() => pipeline),
    raw: jest.fn<SharpPipeline, [unknown?]>(() => pipeline),
    toBuffer: jest.fn<Promise<Buffer>, []>(async () => {
      const size = width * height * 3;
      if (!size) {
        throw new Error('mock sharp called without size');
      }
      const buffer = Buffer.alloc(size);
      for (let i = 0; i < size; i++) {
        buffer[i] = (i * 17) % 256;
      }
      return buffer;
    }),
    png: jest.fn<SharpPipeline, [unknown?]>(() => pipeline),
  };

  return pipeline;
});

const sharpMock: SharpMock = Object.assign(sharpFactory, {
  cache: cacheMock,
  concurrency: concurrencyMock,
  limitInputPixels: limitInputPixelsMock,
});

jest.mock('onnxruntime-node', () => ({
  __esModule: true,
  Tensor: MockTensor,
  InferenceSession: {
    create: createMock,
  },
}));

jest.mock('../../../../src/modules/images/models.ensure', () => ({
  __esModule: true,
  ensureModelFile: ensureModelFileMock,
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: sharpMock,
  cache: sharpMock.cache,
  concurrency: sharpMock.concurrency,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);

  runMock.mockReset();
  createMock.mockReset();
  ensureModelFileMock.mockReset();
  sharpMock.mockClear();
  sharpMock.cache.mockClear();
  sharpMock.concurrency.mockClear();
  limitInputPixelsMock.mockClear();
  sharpResizeCalls.length = 0;

  sessionMock.inputNames = ['pixel_values'];
  sessionMock.outputNames = ['image_embeds'];
  sessionMock.inputMetadata = { pixel_values: { dimensions: [1, 3, 224, 224] } };
  sessionMock.outputMetadata = { image_embeds: { dimensions: [1, 512] } };
  sessionMock.run = runMock;

  createMock.mockImplementation(async () => sessionMock);
  ensureModelFileMock.mockResolvedValue();
});

afterAll(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});

type LocalOpenclipModule =
  typeof import('../../../../src/modules/images/embedding/local-openclip-light.js');
const modulePath = '../../../../src/modules/images/embedding/local-openclip-light.js';
const loadModule = (): LocalOpenclipModule => require(modulePath) as LocalOpenclipModule;

describe('local-openclip-light helpers', () => {
  it('uses explicit ORT log level when numeric', async () => {
    process.env.ORT_LOG_LEVEL = '2';
    process.env.NODE_ENV = 'production';
    const { resolveOrtLogLevel } = loadModule();
    expect(resolveOrtLogLevel()).toBe(2);
  });

  it('clamps invalid log levels into the allowed range', async () => {
    process.env.ORT_LOG_LEVEL = '99';
    const { resolveOrtLogLevel } = loadModule();
    expect(resolveOrtLogLevel()).toBe(4 as OrtLogLevel);
  });

  it('defaults to verbose logging in test environments', async () => {
    delete process.env.ORT_LOG_LEVEL;
    process.env.NODE_ENV = 'test';
    const { resolveOrtLogLevel } = loadModule();
    expect(resolveOrtLogLevel()).toBe(3 as OrtLogLevel);
  });

  it('converts common half precision values to float32', async () => {
    const { fp16ToFloat32Array } = loadModule();
    const input = new Uint16Array([0x0000, 0x3c00, 0xc000, 0x7c00, 0xfc00]);
    expect(Array.from(fp16ToFloat32Array(input))).toEqual([0, 1, -2, Infinity, -Infinity]);
  });

  it('normalizes vectors and rejects invalid inputs', async () => {
    const { l2NormalizeChecked } = loadModule();

    const vec = new Float32Array(512);
    for (let i = 0; i < vec.length; i++) vec[i] = (i % 7) + 1;
    const normed = l2NormalizeChecked(vec);
    expect(normed.length).toBe(512);
    const sumSq = normed.reduce((acc: number, v: number) => acc + v * v, 0);
    expect(sumSq).toBeCloseTo(1, 5);

    const zero = new Float32Array(512);
    expect(() => l2NormalizeChecked(zero)).toThrow('zero or invalid norm');
  });
});

describe('initLocalOpenCLIP', () => {
  it('initializes the session using R2 configuration and normalizes embeddings', async () => {
    process.env.EMBED_IMAGE_SIZE = '224';
    const output = new Float32Array(512);
    output.fill(2);
    runMock.mockResolvedValue({
      image_embeds: new MockTensor('float32', output, [1, 512]),
    });

    process.env.EMBED_MODEL_URL = 'https://example.com/model.onnx';
    process.env.EMBED_MODEL_R2_KEY = 'clip-model';
    process.env.R2_BUCKET = 'models';
    process.env.MODEL_DIR = '/tmp/models';
    process.env.EMBED_MODEL_SHA256 = 'abc123';

    const { initLocalOpenCLIP, embedImage } = loadModule();

    await initLocalOpenCLIP();

    expect(ensureModelFileMock).toHaveBeenCalledWith(
      expect.stringContaining('openclip-vit-b32.onnx'),
      { kind: 'r2', bucket: 'models', key: 'clip-model' },
      'abc123',
    );

    const sessionOptions = createMock.mock.calls[0]?.[1];
    expect(sessionOptions).toMatchObject({
      logSeverityLevel: 3,
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'basic',
      enableCpuMemArena: false,
    });

    const embedding = await embedImage(Buffer.from('irrelevant'));
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(embedding.length).toBe(512);
    const norm = Math.sqrt(embedding.reduce((acc: number, v: number) => acc + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);

    const feeds = runMock.mock.calls.at(-1)?.[0] ?? {};
    const tensor = feeds[sessionMock.inputNames[0]] as MockTensor | undefined;
    expect(tensor?.dims).toEqual([1, 3, 224, 224]);

    expect(sharpResizeCalls.at(-1)).toEqual({ width: 224, height: 224 });
  });

  it('probes for static dimensions and converts fp16 outputs', async () => {
    delete process.env.EMBED_IMAGE_SIZE;
    delete process.env.CLIP_IMAGE_SIZE;
    delete process.env.EMBED_MODEL_R2_KEY;
    delete process.env.R2_BUCKET;
    delete process.env.EMBED_MODEL_PATH;

    sessionMock.inputMetadata = { pixel_values: { dimensions: ['batch', 3, 'height', 'width'] } };
    sessionMock.outputMetadata = { image_embeds: { dimensions: [null, 512] } };

    let callCount = 0;
    runMock.mockImplementation(async (feeds: Record<string, MockTensor>) => {
      const tensor = feeds[sessionMock.inputNames[0]];
      const size = tensor.dims[tensor.dims.length - 1];
      if (callCount === 0) {
        callCount++;
        expect(size).toBe(256);
        throw new Error('256 not supported');
      }
      if (callCount === 1) {
        callCount++;
        expect(size).toBe(224);
        return {};
      }

      callCount++;
      const fp16 = new Uint16Array(512);
      for (let i = 0; i < fp16.length; i++) {
        fp16[i] = (0x3c00 + (i % 4)) as number;
      }
      return {
        image_embeds: new MockTensor('float16', fp16, [1, 512]),
      };
    });

    process.env.EMBED_MODEL_URL = 'https://example.com/fallback.onnx';
    process.env.EMBED_MODEL_SHA256 = 'def456';

    const { embedImage } = loadModule();

    const embedding = await embedImage(Buffer.alloc(16));

    expect(ensureModelFileMock).toHaveBeenCalledWith(
      expect.stringContaining('openclip-vit-b32.onnx'),
      { kind: 'url', url: 'https://example.com/fallback.onnx' },
      'def456',
    );

    expect(runMock).toHaveBeenCalledTimes(3);
    expect(sharpResizeCalls.at(-1)).toEqual({ width: 224, height: 224 });

    const norm = Math.sqrt(embedding.reduce((acc: number, v: number) => acc + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
    expect(embedding[0]).toBeGreaterThan(0);
  });
});
