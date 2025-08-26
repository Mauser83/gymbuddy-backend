import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { ensureModelFile } from "../models.ensure";
import type { EmbeddingProvider } from "./provider";

const MODEL_PATH =
  process.env.EMBED_MODEL_PATH ?? "./models/openclip-vit-b32.onnx";
const MODEL_SRC = process.env.EMBED_MODEL_R2_KEY
  ? ({
      kind: "r2",
      bucket: process.env.R2_BUCKET!,
      key: process.env.EMBED_MODEL_R2_KEY!,
    } as const)
  : ({
      kind: "url",
      url:
        process.env.EMBED_MODEL_URL ??
        "https://huggingface.co/immich-app/ViT-B-32__openai/resolve/main/visual/model.onnx",
    } as const);
// optional checksum to guard against bad downloads
const MODEL_SHA = process.env.EMBED_MODEL_SHA256;
const DIM = Number(process.env.EMBED_DIM ?? 512);

const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
const SIZE = 224;

async function toTensorForCLIP(bytes: Uint8Array): Promise<ort.Tensor> {
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

function l2normalize(vec: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / n;
  return out;
}

export class LocalOpenClip implements EmbeddingProvider {
  dim = DIM;
  private sessionPromise: Promise<ort.InferenceSession>;
  constructor(modelPath = MODEL_PATH) {
    this.sessionPromise = (async () => {
      await ensureModelFile(modelPath, MODEL_SRC, MODEL_SHA);
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
      });
    })();
  }
  async embed(bytes: Uint8Array): Promise<number[]> {
    const session = await this.sessionPromise;
    const input = await toTensorForCLIP(bytes);
    const inputName = session.inputNames?.[0] ?? "pixel_values";
    const out = await session.run({ [inputName]: input });
    const firstKey = session.outputNames?.[0] ?? Object.keys(out)[0];
    const arr = out[firstKey].data as Float32Array; // expect [1,DIM]
    const vec = arr.length === this.dim ? arr : arr.slice(0, this.dim);
    const norm = l2normalize(vec);
    return Array.from(norm);
  }
}
