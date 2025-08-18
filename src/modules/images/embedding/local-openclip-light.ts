import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { join, resolve } from 'path';
import { ensureModelFile } from '../models.ensure';

// Safer sharp defaults
sharp.concurrency(1);
sharp.cache(false);
(sharp as any).limitInputPixels?.(2048 * 2048); // plenty; we downscale after

// --- Runtime & memory knobs (MUST set env threads=1 too) ---
function mkSessionOptions(): ort.InferenceSession.SessionOptions {
  const so: Partial<ort.InferenceSession.SessionOptions> = {};
  so.intraOpNumThreads = 1;
  so.interOpNumThreads = 1;
  so.graphOptimizationLevel = 'basic'; // 'all' can spike memory
  so.enableCpuMemArena = false;
  return so as ort.InferenceSession.SessionOptions;
}

// --- Model session (image encoder only) ---
let CLIP_SESS: ort.InferenceSession | null = null;
let INPUT_NAME = 'pixel_values';
let OUTPUT_NAME = 'image_embeds';
let INIT_PROMISE: Promise<void> | null = null;
let TARGET_H = 224;
let TARGET_W = 224;

// CLIP normalization (OpenAI/MobileCLIP/TinyCLIP share these)
const MEAN = Float32Array.from([0.48145466, 0.4578275, 0.40821073]);
const STD  = Float32Array.from([0.26862954, 0.26130258, 0.27577711]);

// Correct FP16 → FP32 conversion
function fp16ToFloat32Array(u16: Uint16Array): Float32Array {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i];
    const s = (h & 0x8000) ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x03ff;
    let val: number;
    if (e === 0) {
      val = s * Math.pow(2, -14) * (f / 1024);
    } else if (e === 0x1f) {
      val = f ? NaN : s * Infinity;
    } else {
      val = s * Math.pow(2, e - 15) * (1 + f / 1024);
    }
    out[i] = val;
  }
  return out;
}

async function toCHWFloat32(input: Buffer, w: number, h: number): Promise<Float32Array> {
  const { data } = await sharp(input)
    .toColourspace('srgb')
    .resize(w, h, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hw = w * h;
  const out = new Float32Array(3 * hw);
  for (let i = 0; i < hw; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    out[i] = (r - MEAN[0]) / STD[0];
    out[hw + i] = (g - MEAN[1]) / STD[1];
    out[2 * hw + i] = (b - MEAN[2]) / STD[2];
  }
  return out;
}

function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const inv = 1 / (Math.sqrt(s) + 1e-12);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

type Metadata = { dimensions: (number | string | null)[] };

export async function initLocalOpenCLIP(): Promise<void> {
  if (CLIP_SESS) return;
  if (INIT_PROMISE) return INIT_PROMISE;

  INIT_PROMISE = (async () => {
    const r2Key = process.env.EMBED_MODEL_R2_KEY;
    const url = process.env.EMBED_MODEL_URL;
    const sha = process.env.EMBED_MODEL_SHA256;
    const localDir = process.env.MODEL_DIR ?? '/opt/models';
    let modelPath =
      process.env.EMBED_MODEL_PATH || join(localDir, 'embed_model.onnx');

    modelPath = resolve(modelPath);

    if (r2Key && url) {
      const src = process.env.R2_BUCKET
        ? ({ kind: 'r2', bucket: process.env.R2_BUCKET!, key: r2Key } as const)
        : ({ kind: 'url', url } as const);
      await ensureModelFile(modelPath, src, sha);
    } else if (url && !process.env.EMBED_MODEL_PATH) {
      await ensureModelFile(modelPath, { kind: 'url', url } as const, sha);
    }

    if (!modelPath) {
      throw new Error(
        'No model path. Set EMBED_MODEL_R2_KEY + EMBED_MODEL_URL (preferred) or EMBED_MODEL_PATH.'
      );
    }

    const so = mkSessionOptions();
    const sess = await ort.InferenceSession.create(modelPath, so);

    // Resolve IO names
    INPUT_NAME = sess.inputNames.includes('pixel_values')
      ? 'pixel_values'
      : sess.inputNames[0];
    OUTPUT_NAME = sess.outputNames.includes('image_embeds')
      ? 'image_embeds'
      : sess.outputNames[0];

    const md = sess.inputMetadata as unknown as Record<string, Metadata>;
    const idm = md[INPUT_NAME];
    const dims = idm?.dimensions ?? [];
    const H = Number(dims[dims.length - 2] ?? 224);
    const W = Number(dims[dims.length - 1] ?? 224);
    TARGET_H = Number.isFinite(H) && H > 0 ? H : 224;
    TARGET_W = Number.isFinite(W) && W > 0 ? W : 224;

    const oMd = sess.outputMetadata as unknown as Record<string, Metadata>;
    const odm = oMd[OUTPUT_NAME];
    const oDims = odm?.dimensions ?? [];
    const D = Number(oDims[oDims.length - 1] ?? 512);
    if (D !== 512) throw new Error(`Unexpected embedding dim ${D}, expected 512.`);

    CLIP_SESS = sess;
    console.log(
      `[openclip] loaded ${modelPath} | in=${INPUT_NAME} out=${OUTPUT_NAME} size=${TARGET_W}x${TARGET_H}`,
    );
  })();

  return INIT_PROMISE;
}

export async function embedImage(buffer: Buffer): Promise<Float32Array> {
  await initLocalOpenCLIP();
  if (!CLIP_SESS) throw new Error('CLIP session not initialized');

  const chw = await toCHWFloat32(buffer, TARGET_W, TARGET_H);
  const tensor = new ort.Tensor('float32', chw, [1, 3, TARGET_H, TARGET_W]);

  const out = await CLIP_SESS.run({ [INPUT_NAME]: tensor });
  const t = out[OUTPUT_NAME] as ort.Tensor;

  const dtype =
    (t as any).type ??
    (t.data instanceof Float32Array
      ? 'float32'
      : t.data instanceof Uint16Array
      ? 'float16'
      : 'unknown');

  let vecF32: Float32Array;
  if (dtype === 'float32' && t.data instanceof Float32Array) {
    vecF32 = t.data;
  } else if (dtype === 'float16' && t.data instanceof Uint16Array) {
    vecF32 = fp16ToFloat32Array(t.data);
  } else if (Array.isArray(t.data)) {
    vecF32 = Float32Array.from(t.data as unknown as number[]);
  } else {
    vecF32 = Float32Array.from(t.data as Iterable<number>);
  }

  let min = Infinity,
    max = -Infinity,
    nz = 0,
    nan = 0;
  for (let i = 0; i < vecF32.length; i++) {
    const v = vecF32[i];
    if (!Number.isFinite(v)) nan++;
    if (v !== 0 && Number.isFinite(v)) nz++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (nz === 0) {
    console.warn(
      `[openclip] WARNING: pre-norm embedding has no non-zero finite values (dtype=${dtype}, min=${min}, max=${max}, nan=${nan})`,
    );
  }

  return l2normalize(vecF32);
}

// Optional: typed dim if you need it elsewhere
export const EMBEDDING_DIM = 512;