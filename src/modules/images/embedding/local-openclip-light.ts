import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { join, resolve } from 'path';
import { ensureModelFile } from '../models.ensure';

// Ensure sharp doesn't blow up memory on large inputs
sharp.concurrency(1);
sharp.cache(false);
(sharp as any).limitInputPixels?.(2048 * 2048); // we downscale to model size anyway

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

// Track model-required spatial size; default to 224
let TARGET_H = 224;
let TARGET_W = 224;

// CLIP normalization (OpenAI/MobileCLIP/TinyCLIP share these)
const MEAN = Float32Array.from([0.48145466, 0.4578275, 0.40821073]);
const STD  = Float32Array.from([0.26862954, 0.26130258, 0.27577711]);

// Minimal metadata type for input/output tensors
type Metadata = { dimensions?: readonly number[] };

// Preprocess Buffer -> Float32 CHW tensor of given size
async function toCHWFloat32(
  input: Buffer,
  w: number,
  h: number,
): Promise<Float32Array> {
  const { data } = await sharp(input)
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
    out[i] = (r - MEAN[0]) / STD[0];            // R
    out[hw + i] = (g - MEAN[1]) / STD[1];       // G
    out[2 * hw + i] = (b - MEAN[2]) / STD[2];   // B
  }
  return out;
}

// Convert fp16 tensor data to fp32
function fp16ToFloat32(u16: Uint16Array): Float32Array {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const x = u16[i];
    const s = (x & 0x8000) >> 15;
    const e = (x & 0x7c00) >> 10;
    const f = x & 0x03ff;
    let val: number;
    if (e === 0) {
      val = f * 5.960464477539063e-8; // 2^-24
    } else if (e === 0x1f) {
      val = f ? NaN : Infinity;
    } else {
      val = (1 + f / 1024) * Math.pow(2, e - 15);
    }
    out[i] = s ? -val : val;
  }
  return out;
}

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

    // Read expected input dims (e.g., [1,3,256,256])
    const inputs = sess.inputMetadata as unknown as Record<string, Metadata>;
    const idm = inputs[INPUT_NAME];
    const idims = idm?.dimensions ?? [];
    const H = Number(idims[idims.length - 2] ?? 224);
    const W = Number(idims[idims.length - 1] ?? 224);
    TARGET_H = Number.isFinite(H) && H > 0 ? H : 224;
    TARGET_W = Number.isFinite(W) && W > 0 ? W : 224;

    // Ensure output dim is 512
    const outputs = sess.outputMetadata as unknown as Record<string, Metadata>;
    const odm = outputs[OUTPUT_NAME];
    const odims = odm?.dimensions ?? [];
    const D = Number(odims[odims.length - 1] ?? 512);
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
  const outputs = await CLIP_SESS.run({ [INPUT_NAME]: tensor });
  const outAny = outputs[OUTPUT_NAME];
  let vec: Float32Array;
  if (outAny.data instanceof Float32Array) {
    vec = outAny.data as Float32Array;
  } else if ((outAny as any).type === 'float16' || outAny.data instanceof Uint16Array) {
    vec = fp16ToFloat32(outAny.data as Uint16Array);
  } else {
    vec = Float32Array.from(outAny.data as Iterable<number>);
  }

  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  const inv = 1 / (Math.sqrt(s) + 1e-12);
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] * inv;
  return out;
}

// Optional: typed dim if you need it elsewhere
export const EMBEDDING_DIM = 512;
