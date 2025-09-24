// @ts-nocheck -- Jest runtime mocks in this suite are incompatible with NodeNext typings
import { jest } from '@jest/globals';

type SharpChain = {
  metadata: jest.Mock;
  resize: jest.Mock;
  extend: jest.Mock;
  removeAlpha: jest.Mock;
  raw: jest.Mock;
  toBuffer: jest.Mock;
};

const sharpMock = jest.fn<SharpChain, [Buffer | Uint8Array]>(() => {
  throw new Error('sharp mock not configured');
});

jest.mock('sharp', () => ({
  __esModule: true,
  default: sharpMock,
}));

const mockCreate = jest.fn<Promise<any>, [string, any]>();

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

const ensureModelFileMock = jest.fn<Promise<void>, [string, any, string?]>();

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

    const chain: SharpChain = {
      metadata: jest.fn().mockResolvedValue(metadata),
      resize: jest.fn().mockReturnThis(),
      extend: jest.fn().mockReturnThis(),
      removeAlpha: jest.fn().mockReturnThis(),
      raw: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue({ data, info }),
    } as unknown as SharpChain;

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

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run: jest.fn().mockResolvedValue({ preds: { data: logits } }),
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([1, 2, 3]))).resolves.toBe(true);
    expect(session.run).toHaveBeenCalledTimes(1);
  });

  it('detects a person from NMS-style outputs', async () => {
    configureSharp();
    const outputs = new Float32Array([0, 0, 2, 4, 0.9, 0]);

    const session = {
      inputNames: ['images'],
      outputNames: ['nms'],
      outputMetadata: { nms: { dimensions: [1, 6] } },
      run: jest.fn().mockResolvedValue({ nms: { data: outputs } }),
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

    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run: jest.fn().mockResolvedValue({ preds: { data: logits } }),
    };

    mockCreate.mockResolvedValue(session);

    const { hasPerson } = loadModule();
    await expect(hasPerson(Buffer.from([4, 5, 6]))).resolves.toBe(false);
  });

  it('downloads the model from R2 only once and reuses the cached session', async () => {
    process.env.PERSON_MODEL_R2_KEY = 'yolo.onnx';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ACCOUNT_ID = 'acct';

    configureSharp();
    const logits = new Float32Array(85);
    const session = {
      inputNames: ['images'],
      outputNames: ['preds'],
      outputMetadata: { preds: { dimensions: [1, 85] } },
      run: jest.fn().mockResolvedValue({ preds: { data: logits } }),
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
