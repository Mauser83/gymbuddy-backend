import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { ensureModelFile } from "../models.ensure";

// Tunables (env can override)
const MODEL_PATH = process.env.PERSON_MODEL_PATH || "models/yolov5n.onnx";
const MODEL_R2_KEY = process.env.PERSON_MODEL_R2_KEY;
const MODEL_SHA = process.env.PERSON_MODEL_SHA256;
const INPUT_SIZE = Number(process.env.PERSON_INPUT_SIZE || 640);

// Score gates (obj * cls)
const CONF_MIN  = Number(process.env.PERSON_CONF || 0.55);
const OBJ_MIN   = Number(process.env.PERSON_OBJ_MIN || 0.45);

// Shape gates in letterbox space (to avoid plush/mannequin FPs)
const AREA_MIN  = Number(process.env.PERSON_AREA_MIN  || 0.015); // >= 1.5% of frame
const AREA_MAX  = Number(process.env.PERSON_AREA_MAX  || 0.65);  // not almost full frame
const ASP_MIN   = Number(process.env.PERSON_ASPECT_MIN || 1.10); // tall-ish: h/w >= 1.1
const ASP_MAX   = Number(process.env.PERSON_ASPECT_MAX || 5.0);

let sess: ort.InferenceSession | null = null;
async function getSession() {
  if (!sess) {
    if (MODEL_R2_KEY) {
      await ensureModelFile(
        MODEL_PATH,
        { kind: "r2", bucket: process.env.R2_BUCKET!, key: MODEL_R2_KEY },
        MODEL_SHA
      );
    }
    sess = await ort.InferenceSession.create(MODEL_PATH, {
      graphOptimizationLevel: "all",
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      enableCpuMemArena: false,
    } as any);
  }
  return sess;
}

function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }

async function letterboxToNCHW(bytes: Buffer, size: number) {
  const meta = await sharp(bytes).metadata();
  const iw = meta.width!, ih = meta.height!;
  const scale = Math.min(size / iw, size / ih);
  const nw = Math.max(1, Math.round(iw * scale));
  const nh = Math.max(1, Math.round(ih * scale));
  const padw = Math.max(0, Math.floor((size - nw) / 2));
  const padh = Math.max(0, Math.floor((size - nh) / 2));

  const { data } = await sharp(bytes)
    .resize(nw, nh, { fit: "fill" })
    .extend({
      top: padh, bottom: size - nh - padh,
      left: padw, right: size - nw - padw,
      background: { r:114, g:114, b:114, alpha:1 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = new Float32Array(3 * size * size);
  const hw = size * size;
  for (let i = 0, p = 0; i < hw; i++, p += 3) {
    out[0 * hw + i] = data[p] / 255;
    out[1 * hw + i] = data[p + 1] / 255;
    out[2 * hw + i] = data[p + 2] / 255;
  }
  return new ort.Tensor("float32", out, [1, 3, size, size]);
}

// Public API: presence only
export async function hasPerson(bytes: Buffer): Promise<boolean> {
  const session = await getSession();
  const input = session.inputNames[0];
  const output = session.outputNames[0];

  const tensor = await letterboxToNCHW(bytes, INPUT_SIZE);
  const out = await session.run({ [input]: tensor });

  // YOLOv5: [1, N, 85] rows of (cx,cy,w,h,obj,80 classes)
  const arr = out[output].data as Float32Array;
  const N = arr.length / 85;
  const kPerson = 0;
  const frameArea = INPUT_SIZE * INPUT_SIZE;

  for (let i = 0; i < N; i++) {
    const off = i * 85;
    const w  = arr[off + 2];
    const h  = arr[off + 3];
    const obj = sigmoid(arr[off + 4]);
    const cls = sigmoid(arr[off + 5 + kPerson]);
    const score = obj * cls;
    if (obj < OBJ_MIN || score < CONF_MIN) continue;

    // Filter out non-human-like shapes/sizes (letterbox space)
    const areaFrac = (w * h) / frameArea;
    const aspect   = h / Math.max(1e-6, w);
    if (areaFrac < AREA_MIN || areaFrac > AREA_MAX) continue;
    if (aspect   < ASP_MIN  || aspect   > ASP_MAX)  continue;

    // Found one good person detection → true early
    return true;
  }
  return false;
}
