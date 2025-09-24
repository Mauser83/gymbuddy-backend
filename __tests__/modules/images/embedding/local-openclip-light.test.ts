import {
  fp16ToFloat32Array,
  l2NormalizeChecked,
  resolveOrtLogLevel,
} from '../../../../src/modules/images/embedding/local-openclip-light';

describe('local-openclip-light helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOrt = process.env.ORT_LOG_LEVEL;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalOrt === undefined) {
      delete process.env.ORT_LOG_LEVEL;
    } else {
      process.env.ORT_LOG_LEVEL = originalOrt;
    }
  });

  describe('resolveOrtLogLevel', () => {
    it('uses explicit log level when numeric', () => {
      process.env.ORT_LOG_LEVEL = '2';
      process.env.NODE_ENV = 'production';
      expect(resolveOrtLogLevel()).toBe(2);
    });

    it('clamps invalid values into valid range', () => {
      process.env.ORT_LOG_LEVEL = '99';
      expect(resolveOrtLogLevel()).toBe(4);
    });

    it('defaults to verbose warnings in test env', () => {
      delete process.env.ORT_LOG_LEVEL;
      process.env.NODE_ENV = 'test';
      expect(resolveOrtLogLevel()).toBe(3);
    });
  });

  describe('fp16ToFloat32Array', () => {
    it('converts common half precision values', () => {
      const input = new Uint16Array([0x0000, 0x3c00, 0xc000, 0x7c00, 0xfc00]);
      const result = fp16ToFloat32Array(input);
      expect(Array.from(result)).toEqual([0, 1, -2, Infinity, -Infinity]);
    });
  });

  describe('l2NormalizeChecked', () => {
    it('normalizes a 512-d vector and preserves unit length', () => {
      const vec = new Float32Array(512);
      for (let i = 0; i < vec.length; i++) {
        vec[i] = (i % 7) + 1;
      }
      const normed = l2NormalizeChecked(vec);
      const sumSq = normed.reduce((acc, v) => acc + v * v, 0);
      expect(sumSq).toBeCloseTo(1, 5);
      const originalNorm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
      expect(normed[0]).toBeCloseTo(vec[0] / originalNorm, 5);
    });

    it('throws on zero vectors', () => {
      const zero = new Float32Array(512);
      expect(() => l2NormalizeChecked(zero)).toThrow('zero or invalid norm');
    });
  });
});
