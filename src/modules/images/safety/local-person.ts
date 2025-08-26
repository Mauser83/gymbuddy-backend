import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { ensureModelFile } from "../models.ensure";

const PERSON_MODEL_PATH = process.env.PERSON_MODEL_PATH || "models/yolov5n.onnx";
const PERSON_MODEL_SRC = {
  kind: "r2" as const,
  bucket: process.env.R2_BUCKET!,
  key: process.env.PERSON_MODEL_R2_KEY || "models/yolov5n.onnx",
};
const PERSON_MODEL_SHA = process.env.PERSON_MODEL_SHA256;
const PERSON_INPUT_SIZE = Number(process.env.PERSON_INPUT_SIZE || 640);
const PERSON_CONF = Number(process.env.PERSON_CONF || 0.25);
const PERSON_IOU = Number(process.env.PERSON_IOU || 0.45);
const PERSON_TOPK = Number(process.env.PERSON_TOPK || 5);
const PERSON_MIN_SHORT = Number(process.env.PERSON_MIN_SHORT || 2);
const PERSON_MIN_AREA = Number(process.env.PERSON_MIN_AREA || 64);

let session: ort.InferenceSession | null = null;
async function getSession() {
  if (!session) {
    await ensureModelFile(PERSON_MODEL_PATH, PERSON_MODEL_SRC, PERSON_MODEL_SHA);
    session = await ort.InferenceSession.create(PERSON_MODEL_PATH, {
      graphOptimizationLevel: "all",
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      enableCpuMemArena: false,
    } as any);
  }
  return session;
}

// Deterministic letterbox to square with 114 bg
async function letterbox(bytes: Buffer, size: number) {
  const meta = await sharp(bytes).metadata();
  const iw = meta.width!, ih = meta.height!;
  const scale = Math.min(size / iw, size / ih);
  let nw = Math.max(1, Math.round(iw * scale));
  let nh = Math.max(1, Math.round(ih * scale));
  const padw = Math.max(0, Math.floor((size - nw) / 2));
  const padh = Math.max(0, Math.floor((size - nh) / 2));

  const { data } = await sharp(bytes)
    .resize(nw, nh, { fit: "fill" })
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

  return { tensor: new ort.Tensor("float32", out, [1, 3, size, size]), iw, ih, size, scale, padw, padh };
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function nms(boxes: number[][], scores: number[], iouThr: number) {
  const order = scores
    .map((s, i) => [s, i] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  const picked: number[] = [];
  while (order.length) {
    const i = order.shift()!;
    picked.push(i);
    const [x1, y1, x2, y2] = boxes[i];
    for (let j = order.length - 1; j >= 0; j--) {
      const k = order[j];
      const [xx1, yy1, xx2, yy2] = boxes[k];
      const w = Math.max(0, Math.min(x2, xx2) - Math.max(x1, xx1));
      const h = Math.max(0, Math.min(y2, yy2) - Math.max(y1, yy1));
      const inter = w * h;
      const areaI = (x2 - x1) * (y2 - y1);
      const areaK = (xx2 - xx1) * (yy2 - yy1);
      const iou = inter / (areaI + areaK - inter + 1e-9);
      if (iou > iouThr) order.splice(j, 1);
    }
  }
  return picked;
}

function clampToImageInt(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  iw: number,
  ih: number,
) {
  let left = Math.min(x1, x2);
  let top = Math.min(y1, y2);
  let right = Math.max(x1, x2);
  let bottom = Math.max(y1, y2);

  left = Math.max(0, Math.min(iw, left));
  top = Math.max(0, Math.min(ih, top));
  right = Math.max(0, Math.min(iw, right));
  bottom = Math.max(0, Math.min(ih, bottom));

  left = Math.floor(left);
  top = Math.floor(top);
  right = Math.ceil(right);
  bottom = Math.ceil(bottom);

  if (right <= left) right = Math.min(iw, left + 1);
  if (bottom <= top) bottom = Math.min(ih, top + 1);

  const width = right - left;
  const height = bottom - top;
  return { left, top, width, height };
}

export type PersonDetection = {
  hasPerson: boolean;
  personCount: number;
  boxes: Array<{ left: number; top: number; width: number; height: number; score: number }>;
};

export async function detectPersons(bytes: Buffer): Promise<PersonDetection> {
  const sess = await getSession();
  const inName = sess.inputNames[0];
  const outName = sess.outputNames[0];

  const prep = await letterbox(bytes, PERSON_INPUT_SIZE);
  const out = await sess.run({ [inName]: prep.tensor });
  const data = out[outName].data as Float32Array; // [1, N, 85]
  const n = data.length / 85;

  const boxesXYXY: number[][] = [];
  const scores: number[] = [];
  const kPerson = 0;

  for (let i = 0; i < n; i++) {
    const off = i * 85;
    const cx = data[off + 0];
    const cy = data[off + 1];
    const w = data[off + 2];
    const h = data[off + 3];
    const obj = sigmoid(data[off + 4]);
    const cls = sigmoid(data[off + 5 + kPerson]);
    const score = obj * cls;
    if (score < PERSON_CONF) continue;

    const x1 = cx - w / 2;
    const y1 = cy - h / 2;
    const x2 = cx + w / 2;
    const y2 = cy + h / 2;
    boxesXYXY.push([x1, y1, x2, y2]);
    scores.push(score);
  }

  if (!scores.length)
    return { hasPerson: false, personCount: 0, boxes: [] };

  const keepIdx = nms(boxesXYXY, scores, PERSON_IOU);
  let boxes = keepIdx.map((i) => {
    const [x1, y1, x2, y2] = boxesXYXY[i];
    const ox1 = (x1 - prep.padw) / prep.scale;
    const oy1 = (y1 - prep.padh) / prep.scale;
    const ox2 = (x2 - prep.padw) / prep.scale;
    const oy2 = (y2 - prep.padh) / prep.scale;
    const b = clampToImageInt(ox1, oy1, ox2, oy2, prep.iw, prep.ih);
    return { ...b, score: scores[i] };
  });

  boxes = boxes
    .filter((b) => Math.min(b.width, b.height) >= PERSON_MIN_SHORT && b.width * b.height >= PERSON_MIN_AREA)
    .sort((a, b) => b.score - a.score)
    .slice(0, PERSON_TOPK);

  return { hasPerson: boxes.length > 0, personCount: boxes.length, boxes };
}
