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

async function toCHWFloat32(input: Buffer, W: number, H: number): Promise<Float32Array> {
  const resized = await sharp(input, { unlimited: false })
    .rotate()
    .resize(W, H, { fit: 'cover' })
    .removeAlpha()
    .toColourspace('rgb')
    .raw()
    .toBuffer();

  if (resized.length !== W * H * 3) {
    throw new Error(`[prep] unexpected buffer size ${resized.length} for ${W}x${H}x3`);
  }

  const f32 = new Float32Array(resized.length);
  for (let i = 0; i < resized.length; i++) f32[i] = resized[i] / 255;

  let minv = Infinity,
    maxv = -Infinity,
    mean = 0;
  for (let i = 0; i < f32.length; i++) {
    const v = f32[i];
    if (v < minv) minv = v;
    if (v > maxv) maxv = v;
    mean += v;
  }
  mean /= f32.length;
  console.log('[prep] raw[0..1] min/max/mean:', minv, maxv, mean);

  const chw = new Float32Array(3 * H * W);
  let idx = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = f32[idx++];
      const g = f32[idx++];
      const b = f32[idx++];
      chw[0 * H * W + y * W + x] = (r - MEAN[0]) / STD[0];
      chw[1 * H * W + y * W + x] = (g - MEAN[1]) / STD[1];
      chw[2 * H * W + y * W + x] = (b - MEAN[2]) / STD[2];
    }
  }

  let nmin = Infinity,
    nmax = -Infinity,
    nmean = 0;
  for (let i = 0; i < chw.length; i++) {
    const v = chw[i];
    if (v < nmin) nmin = v;
    if (v > nmax) nmax = v;
    nmean += v;
  }
  nmean /= chw.length;
  console.log('[prep] norm min/max/mean:', nmin, nmax, nmean);

  return chw;
}

function l2NormalizeChecked(vec: Float32Array): Float32Array {
  const D = vec.length;
  if (D !== 512 && D !== 1 * 512) {
    throw new Error(`[embed] unexpected embed length ${D}; expected 512`);
  }
  let ss = 0,
    hasNaN = false;
  for (let i = 0; i < 512; i++) {
    const v = vec[i];
    if (Number.isNaN(v)) hasNaN = true;
    ss += v * v;
  }
  if (hasNaN) throw new Error('[embed] NaN in embedding');
  const norm = Math.sqrt(ss);
  console.log('[embed] pre-norm L2:', norm);
  if (!(norm > 0)) throw new Error('[embed] zero or invalid norm; refusing to output zeros');
  const out = new Float32Array(512);
  for (let i = 0; i < 512; i++) out[i] = vec[i] / norm;
  console.log('[embed] post-norm sample:', Array.from(out.slice(0, 8)));
  return out;
}

type Metadata = { dimensions: (number | string | null)[] };

function parseStaticHW(dims: readonly (number | string)[]) {
  const rawH = dims?.[dims.length - 2];
  const rawW = dims?.[dims.length - 1];

  const asNum = (v: number | string | undefined): number | undefined => {
    if (typeof v === 'number') return v > 0 ? v : undefined;
    if (typeof v === 'string') {
      const m = v.match(/^\d+$/);
      if (m) {
        const n = parseInt(v, 10);
        return n > 0 ? n : undefined;
      }
    }
    return undefined;
  };

  const H = asNum(rawH);
  const W = asNum(rawW);

  return { H, W };
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
    console.log('[embed] inputs:', sess.inputNames);
    console.log('[embed] outputs:', sess.outputNames);
    const inName = sess.inputNames[0];
    const outName = sess.outputNames[0];
    const inMeta = (sess.inputMetadata as any)[inName];
    const outMeta = (sess.outputMetadata as any)[outName];
    console.log('[embed] input meta:', {
      type: inMeta?.type,
      dims: inMeta?.dimensions,
    });
    console.log('[embed] output meta:', {
      type: outMeta?.type,
      dims: outMeta?.dimensions,
    });

    // Resolve IO names
    INPUT_NAME = sess.inputNames.includes('pixel_values')
      ? 'pixel_values'
      : sess.inputNames[0];
    OUTPUT_NAME = sess.outputNames.includes('image_embeds')
      ? 'image_embeds'
      : sess.outputNames[0];

    const md = sess.inputMetadata as unknown as Record<string, Metadata>;
    const meta = md[INPUT_NAME];
    const dimsRaw = meta?.dimensions ?? [];
    console.log('[openclip] input dims raw:', JSON.stringify(dimsRaw));

    const ENV_SIZE = Number(
      process.env.EMBED_IMAGE_SIZE ?? process.env.CLIP_IMAGE_SIZE,
    );
    let targetH: number | undefined;
    let targetW: number | undefined;

    if (Number.isFinite(ENV_SIZE) && ENV_SIZE > 0) {
      targetH = ENV_SIZE;
      targetW = ENV_SIZE;
    } else {
      const { H, W } = parseStaticHW(
        dimsRaw.filter((d): d is number | string => d != null),
      );
      targetH = H;
      targetW = W;

      if (!Number.isFinite(targetH) || !Number.isFinite(targetW)) {
        for (const s of [256, 224]) {
          try {
            const dummy = new ort.Tensor(
              'float32',
              new Float32Array(1 * 3 * s * s),
              [1, 3, s, s],
            );
            await sess.run({ [INPUT_NAME]: dummy });
            targetH = s;
            targetW = s;
            console.log(`[openclip] size autodetected by probe: ${s}x${s}`);
            break;
          } catch {
            // try next
          }
        }
      }
    }

    if (!Number.isFinite(targetH) || !Number.isFinite(targetW)) {
      targetH = 224;
      targetW = 224;
    }

    TARGET_H = targetH!;
    TARGET_W = targetW!;
    console.log(`[openclip] resolved input size: ${TARGET_H}x${TARGET_W}`);


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
const feeds = { [INPUT_NAME]: tensor } as Record<string, ort.Tensor>;
  const results = await CLIP_SESS.run(feeds);
  const tens = results[OUTPUT_NAME] as ort.Tensor;
  console.log(
    '[embed] out type:',
    (tens as any).type,
    'dims:',
    (tens as any).dims,
    'len:',
    tens.data?.length,
  );

  let vec: Float32Array;
  if ((tens as any).type === 'float16') {
    const raw = tens.data as Uint16Array;
    console.log('[embed] raw16 sample:', Array.from(raw.slice(0, 8)));
    vec = fp16ToFloat32Array(raw);
  } else if ((tens as any).type === 'float32') {
    vec = tens.data as Float32Array;
  } else {
    throw new Error(`[embed] unexpected output type ${(tens as any).type}`);
  }
  console.log('[embed] f32 sample:', Array.from(vec.slice(0, 8)));

  return l2NormalizeChecked(vec);
}

// Optional: typed dim if you need it elsewhere
export const EMBEDDING_DIM = 512;