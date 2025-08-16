import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { ensureModelFile } from "../models.ensure";
import type { SafetyProvider, SafetyResult } from "./provider";

const MODEL_PATH = process.env.SAFETY_MODEL_PATH ?? "./models/open_nsfw.onnx";
const MODEL_SRC = process.env.SAFETY_MODEL_R2_KEY
  ? ({
      kind: "r2",
      bucket: process.env.R2_BUCKET!,
      key: process.env.SAFETY_MODEL_R2_KEY!,
    } as const)
  : ({
      kind: "url",
      url:
        process.env.SAFETY_MODEL_URL ??
        "https://huggingface.co/sommersoft/open_nsfw/resolve/main/open_nsfw.onnx",
    } as const);
const MODEL_SHA = process.env.SAFETY_MODEL_SHA256;
const LABELS = (process.env.SAFETY_OUTPUT_LABELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const NSFW_LABELS = new Set(
  (process.env.SAFETY_NSFW_CLASSES ?? "porn,hentai,soft,sexy,nsfw")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

async function toTensorForImageNet(bytes: Uint8Array): Promise<ort.Tensor> {
  const img = sharp(bytes).removeAlpha().resize(SIZE, SIZE, { fit: "cover" });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels < 3) throw new Error("image not RGB");
  const chw = new Float32Array(1 * 3 * SIZE * SIZE);
  let o = 0;
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = (y * info.width + x) * info.channels + c;
        const v = data[i] / 255;
        chw[o++] = (v - MEAN[c]) / STD[c];
      }
    }
  }
  return new ort.Tensor("float32", chw, [1, 3, SIZE, SIZE]);
}

function softmax(v: Float32Array): Float32Array {
  const m = Math.max(...v);
  const exps = v.map((x) => Math.exp(x - m));
  const s = exps.reduce((a, b) => a + b, 0) || 1;
  return Float32Array.from(exps.map((x) => x / s));
}

export class LocalNSFW implements SafetyProvider {
  private sessionPromise: Promise<ort.InferenceSession>;
  constructor(modelPath = MODEL_PATH) {
    this.sessionPromise = (async () => {
      await ensureModelFile(modelPath, MODEL_SRC, MODEL_SHA);
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
      });
    })();
  }
  async check(bytes: Uint8Array): Promise<SafetyResult> {
    const session = await this.sessionPromise;
    const input = await toTensorForImageNet(bytes);
    const inputName = session.inputNames?.[0] ?? "input";
    const out = await session.run({ [inputName]: input });
    const firstKey = session.outputNames?.[0] ?? Object.keys(out)[0];
    const logits = out[firstKey].data as Float32Array;

    // Heuristics:
    // - If single output -> already a probability (0..1)
    // - Else apply softmax and aggregate NSFW labels if provided; otherwise take 1 - neutral/drawings if present; else max(prob)
    let nsfwScore = 0;
    if (logits.length === 1) {
      nsfwScore = Math.min(1, Math.max(0, logits[0]));
    } else {
      const probs = softmax(logits);
      if (LABELS.length === probs.length) {
        let nsfw = 0,
          neutral = 0;
        LABELS.forEach((lab, i) => {
          const p = probs[i];
          if (NSFW_LABELS.has(lab)) nsfw += p;
          if (lab === "neutral" || lab === "drawings") neutral += p;
        });
        nsfwScore = nsfw || Math.max(0, 1 - neutral);
      } else {
        nsfwScore = Math.max(...probs);
      }
    }

    const isSafe = nsfwScore < 0.5; // threshold; tune later
    return { isSafe, nsfwScore, hasPerson: null };
  }
}
