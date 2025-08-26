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
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const SIZE = 224;
const SAFETY_PREPROC = (process.env.SAFETY_PREPROC ?? "vgg").toLowerCase();
const SAFETY_COLOR = (process.env.SAFETY_COLOR ?? "bgr").toLowerCase();

// NCHW [1,3,H,W]
async function toTensorNCHW(bytes: Uint8Array): Promise<ort.Tensor> {
  const { data, info } = await sharp(bytes)
    .removeAlpha()
    .resize(SIZE, SIZE, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // order: [B,G,R] or [R,G,B] depending on SAFETY_COLOR
  const out = new Float32Array(1 * 3 * SIZE * SIZE);
  let oB = 0 * SIZE * SIZE; // channel 0
  let oG = 1 * SIZE * SIZE; // channel 1
  let oR = 2 * SIZE * SIZE; // channel 2

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = (y * info.width + x) * info.channels;
      const r = data[p],
        g = data[p + 1],
        b = data[p + 2];

      if (SAFETY_PREPROC === "vgg") {
        // Caffe/OpenNSFW: BGR 0..255 minus mean values
        out[oB++] = (SAFETY_COLOR === "bgr" ? b : r) - 104;
        out[oG++] = g - 117;
        out[oR++] = (SAFETY_COLOR === "bgr" ? r : b) - 123;
      } else {
        // ImageNet normalization
        out[oR++] = (r / 255 - 0.485) / 0.229;
        out[oG++] = (g / 255 - 0.456) / 0.224;
        out[oB++] = (b / 255 - 0.406) / 0.225;
      }
    }
  }

  return new ort.Tensor("float32", out, [1, 3, SIZE, SIZE]);
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
    const inputName = session.inputNames?.[0] ?? "input";
    const input = await toTensorNCHW(bytes);
    const out = await session.run({ [inputName]: input });
    const firstKey = session.outputNames?.[0] ?? Object.keys(out)[0];
    const logits = out[firstKey].data as Float32Array;

    // Heuristics:
    // - If single output -> already a probability (0..1)
    // - Else apply softmax and aggregate NSFW labels if provided
    // - Else if two outputs -> assume [SFW, NSFW]
    // - Else fall back to conservative 0
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
          if (NSFW_LABELS.has(lab.toLowerCase())) nsfw += p;
          if (lab.toLowerCase() === "neutral" || lab.toLowerCase() === "drawings")
            neutral += p;
        });
        nsfwScore = nsfw || Math.max(0, 1 - neutral);
      } else if (probs.length === 2) {
        nsfwScore = probs[1];
      } else {
        nsfwScore = 0;
      }
    }

    const isSafe = nsfwScore < 0.5; // threshold; tune later
    return { isSafe, nsfwScore, hasPerson: null };
  }
}