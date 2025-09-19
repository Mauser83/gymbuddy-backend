import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

import { ensureModelFile } from '../models.ensure';

// Tunables (env can override)
const MODEL_PATH = process.env.PERSON_MODEL_PATH || 'models/yolov5s.onnx';
const MODEL_R2_KEY = process.env.PERSON_MODEL_R2_KEY;
const MODEL_SHA = process.env.PERSON_MODEL_SHA256;
const INPUT_SIZE = Number(process.env.PERSON_INPUT_SIZE || 640);

// Keep thresholds moderate to confirm the pipeline first
const CONF_MIN = Number(process.env.PERSON_CONF || 0.45); // final score threshold
const OBJ_MIN = Number(process.env.PERSON_OBJ_MIN || 0.25);

const AREA_MIN = Number(process.env.PERSON_AREA_MIN || 0.005); // 0.5% of frame
const AREA_MAX = Number(process.env.PERSON_AREA_MAX || 0.9);
const ASP_MIN = Number(process.env.PERSON_ASPECT_MIN || 0.5); // allow seated/lying
const ASP_MAX = Number(process.env.PERSON_ASPECT_MAX || 7.0);

let sess: ort.InferenceSession | null = null;
async function getSession() {
  if (!sess) {
    if (MODEL_R2_KEY) {
      await ensureModelFile(
        MODEL_PATH,
        { kind: 'r2', bucket: process.env.R2_BUCKET!, key: MODEL_R2_KEY },
        MODEL_SHA,
      );
    }
    sess = await ort.InferenceSession.create(MODEL_PATH, {
      graphOptimizationLevel: 'all',
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      enableCpuMemArena: false,
    } as any);
  }
  return sess;
}

function maybeSigmoid(v: number) {
  // If already a probability (0..1), don't sigmoid again.
  return v >= 0 && v <= 1 ? v : 1 / (1 + Math.exp(-v));
}

async function letterboxNCHW(bytes: Buffer, size: number) {
  const meta = await sharp(bytes).metadata();
  const iw = meta.width!,
    ih = meta.height!;
  const scale = Math.min(size / iw, size / ih);
  const nw = Math.max(1, Math.round(iw * scale));
  const nh = Math.max(1, Math.round(ih * scale));
  const padw = Math.max(0, Math.floor((size - nw) / 2));
  const padh = Math.max(0, Math.floor((size - nh) / 2));

  const { data } = await sharp(bytes)
    .resize(nw, nh, { fit: 'fill' })
    .extend({
      top: padh,
      bottom: size - nh - padh,
      left: padw,
      right: size - nw - padw,
      background: { r: 114, g: 114, b: 114, alpha: 1 },
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
  return new ort.Tensor('float32', out, [1, 3, size, size]);
}

export async function hasPerson(bytes: Buffer): Promise<boolean> {
  const session = await getSession();
  const inName = session.inputNames[0];
  const tensor = await letterboxNCHW(bytes, INPUT_SIZE);

  const outMap = await session.run({ [inName]: tensor });
  const outNames = session.outputNames;

  const frameArea = INPUT_SIZE * INPUT_SIZE;
  const kPerson = 0; // COCO class 0

  // Iterate every output tensor (supports: Nx85, [1,25200,85], 3-scale outputs, or NMS Nx6)
  for (const name of outNames) {
    const t = outMap[name];
    const arr = t.data as Float32Array;

    // Prefer metadata; fallback to dims on tensor for older ORT versions
    const meta = (
      session.outputMetadata as unknown as
        | Record<string, { dimensions?: number[] } | undefined>
        | undefined
    )?.[name];
    const dims = meta?.dimensions ?? (t as any).dims ?? [];

    const last = dims[dims.length - 1];

    // Case A: rows of 85 (cx,cy,w,h,obj,80 classes)
    if (last === 85 || (arr.length % 85 === 0 && last != 6 && last != 7)) {
      for (let i = 0; i + 84 < arr.length; i += 85) {
        const cx = arr[i + 0],
          cy = arr[i + 1];
        const w = arr[i + 2],
          h = arr[i + 3];
        const obj = maybeSigmoid(arr[i + 4]);
        const cls = maybeSigmoid(arr[i + 5 + kPerson]);
        const score = obj * cls;
        if (obj < OBJ_MIN || score < CONF_MIN) continue;

        // Lightweight gates (letterbox space)
        const areaFrac = (w * h) / frameArea;
        const aspect = h / Math.max(1e-6, w);
        if (areaFrac < AREA_MIN || areaFrac > AREA_MAX) continue;
        if (aspect < ASP_MIN || aspect > ASP_MAX) continue;

        return true; // found a valid person
      }
      continue;
    }

    // Case B: built-in NMS export → rows of 6 or 7: [x1,y1,x2,y2,score,class,(batch?)]
    if (last === 6 || last === 7) {
      const stride = last;
      for (let i = 0; i + stride - 1 < arr.length; i += stride) {
        const x1 = arr[i + 0],
          y1 = arr[i + 1];
        const x2 = arr[i + 2],
          y2 = arr[i + 3];
        const score = arr[i + 4]; // already 0..1
        const clsId = Math.round(arr[i + 5]); // integer class id
        if (clsId !== kPerson || score < CONF_MIN) continue;

        const w = Math.max(1e-6, x2 - x1),
          h = Math.max(1e-6, y2 - y1);
        const areaFrac = (w * h) / frameArea;
        const aspect = h / Math.max(1e-6, w);
        if (areaFrac < AREA_MIN || areaFrac > AREA_MAX) continue;
        if (aspect < ASP_MIN || aspect > ASP_MAX) continue;

        return true;
      }
      continue;
    }

    // Case C: unusual layout (e.g., 3 scale outputs with 5D dims). Flatten generically.
    if (arr.length % 85 === 0) {
      for (let i = 0; i + 84 < arr.length; i += 85) {
        const w = arr[i + 2],
          h = arr[i + 3];
        const obj = maybeSigmoid(arr[i + 4]);
        const cls = maybeSigmoid(arr[i + 5 + kPerson]);
        const score = obj * cls;
        if (obj >= OBJ_MIN && score >= CONF_MIN) {
          const areaFrac = (w * h) / frameArea;
          const aspect = h / Math.max(1e-6, w);
          if (
            areaFrac >= AREA_MIN &&
            areaFrac <= AREA_MAX &&
            aspect >= ASP_MIN &&
            aspect <= ASP_MAX
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
