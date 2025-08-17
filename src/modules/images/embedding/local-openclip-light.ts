import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

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

// CLIP normalization (OpenAI/MobileCLIP/TinyCLIP share these)
const MEAN = Float32Array.from([0.48145466, 0.4578275, 0.40821073]);
const STD  = Float32Array.from([0.26862954, 0.26130258, 0.27577711]);

// Preprocess Buffer -> Float32 CHW tensor (224x224)
async function toCHWFloat32(input: Buffer): Promise<Float32Array> {
  const { data } = await sharp(input)
    .resize(224, 224, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hw = 224 * 224;
  const out = new Float32Array(3 * hw);
  for (let i = 0; i < hw; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    out[i] = (r - MEAN[0]) / STD[0];            // R plane
    out[hw + i] = (g - MEAN[1]) / STD[1];       // G plane
    out[2 * hw + i] = (b - MEAN[2]) / STD[2];   // B plane
  }
  return out;
}

function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]*v[i];
  const inv = 1 / (Math.sqrt(s) + 1e-12);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

export async function initLocalOpenCLIP() {
  if (CLIP_SESS) return;
  const modelPath =
    process.env.CLIP_ONNX_PATH ||
    'tinyclip_vit_61m_32_text_29m_int8.onnx'; // or your mobileclip onnx path
  CLIP_SESS = await ort.InferenceSession.create(modelPath, mkSessionOptions());
}

export async function embedImage(buffer: Buffer): Promise<Float32Array> {
  if (!CLIP_SESS) throw new Error('CLIP session not initialized');
  const chw = await toCHWFloat32(buffer);
  const tensor = new ort.Tensor('float32', chw, [1, 3, 224, 224]);

  // Input/output names must match your ONNX export
  const feeds: Record<string, ort.Tensor> = { pixel_values: tensor };
  const outputs = await CLIP_SESS.run(feeds);
  // Prefer an explicit key if you know it, else take the first
  const key = outputs['image_embeds'] ? 'image_embeds' : Object.keys(outputs)[0];
  const vec = outputs[key].data as Float32Array; // [1,512]
  return l2normalize(vec);
}

// Optional: typed dim if you need it elsewhere
export const EMBEDDING_DIM = 512;