import {
  fp16ToFloat32Array,
  l2NormalizeChecked,
  resolveOrtLogLevel,
} from '../../../../src/modules/images/embedding/local-openclip-light';

const ORIGINAL_ENV = { ...process.env };

describe('resolveOrtLogLevel', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('clamps explicit numeric values into the valid severity range', () => {
    process.env.ORT_LOG_LEVEL = '7';
    expect(resolveOrtLogLevel()).toBe(4);

    process.env.ORT_LOG_LEVEL = '-5';
    expect(resolveOrtLogLevel()).toBe(0);
  });

  it('defaults to verbose logging in test mode when unset or invalid', () => {
    delete process.env.ORT_LOG_LEVEL;
    process.env.NODE_ENV = 'test';
    expect(resolveOrtLogLevel()).toBe(3);

    process.env.ORT_LOG_LEVEL = 'not-a-number';
    expect(resolveOrtLogLevel()).toBe(3);
  });

  it('falls back to production quiet mode outside of tests', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ORT_LOG_LEVEL;
    expect(resolveOrtLogLevel()).toBe(0);
  });
});

describe('fp16ToFloat32Array', () => {
  it('handles denormal, infinity, NaN and regular numbers', () => {
    const values = new Uint16Array([
      0x0001, // denormal
      0x3c00, // 1.0
      0x7c00, // +infinity
      0x7e00, // NaN
    ]);
    const floats = fp16ToFloat32Array(values);

    expect(floats[0]).toBeCloseTo(Math.pow(2, -14) / 1024, 10);
    expect(floats[1]).toBeCloseTo(1.0, 5);
    expect(floats[2]).toBe(Infinity);
    expect(Number.isNaN(floats[3])).toBe(true);
  });
});

describe('l2NormalizeChecked', () => {
  it('throws when the vector length is not 512', () => {
    const vec = new Float32Array(2);
    expect(() => l2NormalizeChecked(vec)).toThrow(/unexpected embed length/);
  });

  it('throws when the vector contains NaN values', () => {
    const vec = new Float32Array(512);
    vec[0] = NaN;
    vec[1] = 1;
    expect(() => l2NormalizeChecked(vec)).toThrow(/NaN/);
  });

  it('throws when the norm is zero or invalid', () => {
    const vec = new Float32Array(512);
    expect(() => l2NormalizeChecked(vec)).toThrow(/zero or invalid norm/);
  });

  it('returns a unit-length vector when inputs are valid', () => {
    const vec = new Float32Array(512);
    for (let i = 0; i < 8; i++) {
      vec[i] = i + 1;
    }

    const normalized = l2NormalizeChecked(vec);
    let sumSquares = 0;
    for (let i = 0; i < normalized.length; i++) {
      sumSquares += normalized[i] * normalized[i];
      if (i < 8) {
        expect(normalized[i]).toBeCloseTo(vec[i] / Math.sqrt(204));
      } else {
        expect(normalized[i]).toBe(0);
      }
    }

    expect(sumSquares).toBeCloseTo(1, 6);
  });
});
