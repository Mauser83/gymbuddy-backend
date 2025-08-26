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
const PERSON_INPUT_SIZE = Number(process.env.PERSON_INPUT_SIZE || 640); // 320 or 640
const PERSON_CONF = Number(process.env.PERSON_CONF || 0.25);
const PERSON_IOU = Number(process.env.PERSON_IOU || 0.45);

let session: ort.InferenceSession | null = null;
async function getSession() {
  if (!session) {
    await ensureModelFile(PERSON_MODEL_PATH, PERSON_MODEL_SRC, PERSON_MODEL_SHA);
    session = await ort.InferenceSession.create(PERSON_MODEL_PATH, {
      graphOptimizationLevel: "all",
      interOpNumThreads: 1,
      intraOpNumThreads: 1,
      enableCpuMemArena: false,
    } as any);
  }
  return session;
}

// Letterbox to square (114 padding), keep scale & padding to map boxes back
async function letterbox(bytes: Buffer, size: number) {
  const meta = await sharp(bytes).metadata();
  const iw = meta.width!, ih = meta.height!;
  const scale = Math.min(size / iw, size / ih);
  const nw = Math.round(iw * scale);
  const nh = Math.round(ih * scale);
  const padw = Math.floor((size - nw) / 2);
  const padh = Math.floor((size - nh) / 2);

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

  // Build NCHW float32 0..1
  const out = new Float32Array(3 * size * size);
  const hw = size * size;
  for (let i = 0, p = 0; i < hw; i++, p += 3) {
    out[0 * hw + i] = data[p] / 255; // R
    out[1 * hw + i] = data[p + 1] / 255; // G
    out[2 * hw + i] = data[p + 2] / 255; // B
  }

  return {
    tensor: new ort.Tensor("float32", out, [1, 3, size, size]),
    size,
    iw,
    ih,
    scale,
    padw,
    padh,
  };
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

// Non-max suppression (hard NMS)
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

export type PersonDetection = {
  hasPerson: boolean;
  personCount: number;
  boxes: Array<{ x: number; y: number; w: number; h: number; score: number }>;
};

export async function detectPersons(bytes: Buffer): Promise<PersonDetection> {
  const sess = await getSession();
  const inputName = sess.inputNames[0];
  const outputName = sess.outputNames[0];

  const prep = await letterbox(bytes, PERSON_INPUT_SIZE);
  const out = await sess.run({ [inputName]: prep.tensor });
  // YOLOv5 ONNX: [1, N, 85] with (cx,cy,w,h,obj,80 classes)
  const data = out[outputName].data as Float32Array;
  const n = data.length / 85;

  const boxesXYXY: number[][] = [];
  const scores: number[] = [];
  const kPerson = 0; // COCO class 0

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

    // Convert center xywh -> xyxy in letterboxed space
    let x1 = cx - w / 2;
    let y1 = cy - h / 2;
    let x2 = cx + w / 2;
    let y2 = cy + h / 2;

    // Map back to original image
    x1 = (x1 - prep.padw) / prep.scale;
    y1 = (y1 - prep.padh) / prep.scale;
    x2 = (x2 - prep.padw) / prep.scale;
    y2 = (y2 - prep.padh) / prep.scale;

    // Clip
    x1 = Math.max(0, Math.min(prep.iw - 1, x1));
    y1 = Math.max(0, Math.min(prep.ih - 1, y1));
    x2 = Math.max(0, Math.min(prep.iw - 1, x2));
    y2 = Math.max(0, Math.min(prep.ih - 1, y2));

    if (x2 > x1 && y2 > y1) {
      boxesXYXY.push([x1, y1, x2, y2]);
      scores.push(score);
    }
  }

  // NMS
  const keep = nms(boxesXYXY, scores, PERSON_IOU);
  const boxes = keep.map((i) => {
    const [x1, y1, x2, y2] = boxesXYXY[i];
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, score: scores[i] };
  });

  return { hasPerson: boxes.length > 0, personCount: boxes.length, boxes };
}
