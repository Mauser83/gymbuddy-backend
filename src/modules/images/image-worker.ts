import { prisma } from "../../lib/prisma";
import { QueueRunnerService } from "./queue-runner.service";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import {
  initLocalOpenCLIP,
  embedImage,
  EMBEDDING_DIM,
} from "./embedding/local-openclip-light";
import { createSafetyProvider } from "./safety";
import { hasPerson } from "./safety/local-person";
import { writeImageEmbedding } from "../cv/embeddingWriter";

import { ImageJobStatus } from "../../generated/prisma";
import {
  copyObjectIfMissing,
  deleteObjectIgnoreMissing,
} from "../media/media.service";

const queue = new QueueRunnerService(prisma);

// R2 client (account-specific endpoint)
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const BUCKET = process.env.R2_BUCKET!;
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const embedInitPromise = initLocalOpenCLIP();
const safetyProvider = createSafetyProvider();
const MAX_RETRIES = Number(process.env.WORKER_MAX_RETRIES || 3);
const NSFW_FLAG_THRESHOLD = Number(process.env.NSFW_FLAG_THRESHOLD ?? 0.60);
const NSFW_PERSON_DELTA = Number(process.env.NSFW_PERSON_DELTA ?? 0.0);
const EMBED_VENDOR = process.env.EMBED_VENDOR || "local";
const EMBED_MODEL = process.env.EMBED_MODEL || "mobileCLIP-S0";
const EMBED_VERSION = process.env.EMBED_VERSION || "1.0";

// helper: download bytes from R2
async function downloadBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body: any = res.Body;

  // Node 18+ AWS SDK v3 has transformToByteArray(); fallback to stream -> buffer
  if (typeof body?.transformToByteArray === "function")
    return body.transformToByteArray();

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
  }
  // concat
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

// --- HASH handler ---
async function handleHASH(storageKey: string) {
  const bytes = await downloadBytes(storageKey);
  const sha = createHash("sha256").update(bytes).digest("hex");

  // Write sha256 only if missing/empty for the image by storageKey
  await prisma.gymEquipmentImage.updateMany({
    where: { storageKey, OR: [{ sha256: null }, { sha256: "" }] },
    data: { sha256: sha },
  });
}

// --- SAFETY ---
async function handleSAFETY(storageKey: string) {
  const bytes = await downloadBytes(storageKey);
  const buf = Buffer.from(bytes);
  const base = await safetyProvider.check(buf);
  const personPresent = await hasPerson(buf);

  const t = personPresent
    ? Math.max(0, NSFW_FLAG_THRESHOLD - NSFW_PERSON_DELTA)
    : NSFW_FLAG_THRESHOLD;

  const finalScore = base.nsfwScore;
  const isSafe = finalScore < t;

  await prisma.gymEquipmentImage.updateMany({
    where: { storageKey },
    data: {
      isSafe,
      nsfwScore: finalScore,
      hasPerson: personPresent,
    },
  });

  if (!isSafe && storageKey.startsWith("private/gym/")) {
    const parts = storageKey.split("/");
    const gymEqId = parts[2];
    const file = parts[parts.length - 1];
    const ext = file.split(".").pop() || "jpg";
    const baseName = file.split(".")[0];
    const qKey = `private/gym/${gymEqId}/quarantine/${baseName}.${ext}`;
    await copyObjectIfMissing(storageKey, qKey);
    await deleteObjectIgnoreMissing(storageKey);
    await prisma.gymEquipmentImage.updateMany({
      where: { storageKey },
      data: { storageKey: qKey, status: "QUARANTINED" },
    });
    await prisma.imageQueue.updateMany({
      where: { storageKey, jobType: "EMBED", status: ImageJobStatus.pending },
      data: {
        status: ImageJobStatus.failed,
        finishedAt: new Date(),
        lastError: "unsafe",
      },
    });
  }
}

async function handleEMBED(storageKey: string) {
  // 1) locate image rows for this object
  const gymImg = await prisma.gymEquipmentImage.findFirst({
    where: { storageKey },
    select: { id: true, gymId: true },
  });
  const eqImg = gymImg
    ? null
    : await prisma.equipmentImage.findFirst({
        where: { storageKey },
        select: { id: true },
      });
  if (!gymImg && !eqImg) throw new Error("Image not found for storageKey");

  const scopeType = gymImg ? "GYM" : "GLOBAL";
  const gymId = gymImg?.gymId ?? null;

  // 2) compute vector
  const bytes = await downloadBytes(storageKey);
  await embedInitPromise;
  const vecFloat = await embedImage(Buffer.from(bytes));
  let ss = 0;
  for (let i = 0; i < vecFloat.length; i++) ss += vecFloat[i] * vecFloat[i];
  const norm = Math.sqrt(ss);
  if (!(norm > 0)) {
    throw new Error('[embed] zero/invalid norm — refusing to insert');
  }
  const vecNorm = new Float32Array(vecFloat.length);
  for (let i = 0; i < vecFloat.length; i++) vecNorm[i] = vecFloat[i] / norm;
  if (process.env.EMBED_LOG === '1') {
    console.log('[db] writing embed sample:', Array.from(vecNorm.slice(0, 8)));
  }
  const vec = Array.from(vecNorm);

  // 3) write vector to correct table/row
  await writeImageEmbedding({
    target: scopeType === "GYM" ? "GYM" : "GLOBAL",
    imageId: scopeType === "GYM" ? gymImg!.id : eqImg!.id,
    gymId: gymId ?? undefined,
    vector: vec,
    modelVendor: EMBED_VENDOR,
    modelName: EMBED_MODEL,
    modelVersion: EMBED_VERSION,
  });
}

export async function processOnce(limit = Number(process.env.WORKER_CONCURRENCY ?? 1)) {
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 1));
  const jobs = await queue.claimBatch(Math.min(concurrency, limit));

  for (const job of jobs) {
    try {
      if (!job.storageKey) throw new Error("Job missing storageKey");
      const type = (job.jobType ?? "").trim().toUpperCase();
      switch (type) {
        case "HASH":
          await handleHASH(job.storageKey);
          break;
        case "SAFETY":
          await handleSAFETY(job.storageKey);
          break;
        case "EMBED":
          await handleEMBED(job.storageKey);
          break;
        default:
          throw new Error(`Unsupported jobType: ${job.jobType}`);
      }
      await queue.markDone(job.id);
    } catch (err) {
      const attempts = (job as any).attempts ?? 0;
      if (attempts >= MAX_RETRIES) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.imageQueue.update({
          where: { id: job.id },
          data: {
            status: ImageJobStatus.failed,
            finishedAt: new Date(),
            lastError: msg.slice(0, 500),
          },
        });
      } else {
        await queue.markFailed(job.id, err, 30);
      }
    }
  }

  return jobs.length;
}

let isRunning = false;

export async function runOnce(max = Infinity) {
  if (isRunning) return;
  isRunning = true;
  try {
    let processed = 0;
    while (processed < max) {
      const remaining = max - processed;
      const count = await processOnce(remaining);
      if (count === 0) break;
      processed += count;
    }
  } finally {
    isRunning = false;
  }
}