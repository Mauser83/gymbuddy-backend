import { prisma } from "../../lib/prisma";
import { QueueRunnerService } from "./queue-runner.service";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import {
  initLocalOpenCLIP,
  embedImage,
  EMBEDDING_DIM,
} from "./embedding/local-openclip-light";
import { createSafetyProvider } from "./safety";
import sharp from "sharp";
import { detectPersons } from "./safety/local-person";

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

const EMBED_VENDOR = process.env.EMBED_VENDOR ?? "local";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "openclip-vit-b32.onnx";
const EMBED_VERSION = process.env.EMBED_VERSION ?? "1.0";
const MODEL_DIM = Number(process.env.EMBED_DIM ?? EMBEDDING_DIM);
const DB_VECTOR_DIM = Number(process.env.EMBED_DB_DIM ?? MODEL_DIM);

function adaptToDbDim(vec: number[]): number[] {
  if (vec.length === DB_VECTOR_DIM) return vec;
  if (vec.length < DB_VECTOR_DIM)
    return [...vec, ...Array(DB_VECTOR_DIM - vec.length).fill(0)];
  return vec.slice(0, DB_VECTOR_DIM);
}

const embedInitPromise = initLocalOpenCLIP();
const safetyProvider = createSafetyProvider();

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
  const baseSafety = await safetyProvider.check(bytes);
  const person = await detectPersons(buf);

  let nsfwScore = baseSafety.nsfwScore;
  if (person.hasPerson) {
    const crops = await Promise.all(
      person.boxes.map(async (b) => {
        const crop = await sharp(buf)
          .extract({
            left: Math.round(b.x),
            top: Math.round(b.y),
            width: Math.round(b.w),
            height: Math.round(b.h),
          })
          .jpeg()
          .toBuffer();
        const s = await safetyProvider.check(crop);
        return s.nsfwScore;
      })
    );
    const personMax = crops.length ? Math.max(...crops) : 0;
    nsfwScore = Math.max(nsfwScore, personMax);
  }
  const isSafe = nsfwScore < 0.85;

  await prisma.gymEquipmentImage.updateMany({
    where: { storageKey },
    data: {
      isSafe,
      nsfwScore,
      hasPerson: person.hasPerson,
      personCount: person.personCount,
      personBoxes: person.boxes,
    },
  });
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
  const scope = gymImg ? `GYM:${gymId}` : "GLOBAL";

  // 2) compute vector and upsert row with embedding
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
  const vec = adaptToDbDim(Array.from(vecNorm)); // 1536 for DB
  const vectorParam = `[${vec
    .map((v) => (Number.isFinite(v) ? v : 0))
    .join(",")}]`;
  if (scopeType === "GYM" && gymImg) {
    await prisma.$executeRaw`
      INSERT INTO "ImageEmbedding"
        ("id","gymImageId","scope","scope_type","gym_id","modelVendor","modelName","modelVersion","dim","embeddingVec")
      VALUES
        (${randomUUID()}, ${gymImg.id}, ${scope}, ${scopeType}, ${gymId}, ${EMBED_VENDOR}, ${EMBED_MODEL}, ${EMBED_VERSION}, ${DB_VECTOR_DIM}, ${vectorParam}::vector)
      ON CONFLICT ("gymImageId","scope","modelVendor","modelName","modelVersion")
      DO UPDATE SET
        "dim" = EXCLUDED."dim",
        "scope_type" = EXCLUDED."scope_type",
        "gym_id" = EXCLUDED."gym_id",
        "embeddingVec" = ${vectorParam}::vector
    `;
  } else if (scopeType === "GLOBAL" && eqImg) {
    await prisma.$executeRaw`
      INSERT INTO "ImageEmbedding"
        ("id","imageId","scope","scope_type","gym_id","modelVendor","modelName","modelVersion","dim","embeddingVec")
      VALUES
        (${randomUUID()}, ${eqImg.id}, ${scope}, ${scopeType}, NULL, ${EMBED_VENDOR}, ${EMBED_MODEL}, ${EMBED_VERSION}, ${DB_VECTOR_DIM}, ${vectorParam}::vector)
      ON CONFLICT ("imageId","scope","modelVendor","modelName","modelVersion")
      DO UPDATE SET
        "dim" = EXCLUDED."dim",
        "scope_type" = EXCLUDED."scope_type",
        "gym_id" = EXCLUDED."gym_id",
        "embeddingVec" = ${vectorParam}::vector
    `;
  }
}

export async function processOnce() {
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 1));
  const jobs = await queue.claimBatch(concurrency);

  await Promise.all(
    jobs.map(async (job) => {
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
        await queue.markFailed(job.id, err, 30);
      }
    })
  );
}

export async function runOnce(maxLoops = 50) {
  console.log("[image-worker] runOnce called, maxLoops=", maxLoops);
  for (let i = 0; i < maxLoops; i++) {
    await processOnce();
    await new Promise((r) => setTimeout(r, 25));
  }
}
