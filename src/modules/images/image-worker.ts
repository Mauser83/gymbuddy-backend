import { PrismaClient } from "../../generated/prisma";
import { QueueRunnerService } from "./queue-runner.service";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";

const prisma = new PrismaClient();
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

const EMBED_VENDOR  = process.env.EMBED_VENDOR  ?? "local";
const EMBED_MODEL   = process.env.EMBED_MODEL   ?? "clip-vit-b32";
const EMBED_VERSION = process.env.EMBED_VERSION ?? "1.0";
const EMBED_DIM     = Number(process.env.EMBED_DIM ?? 512);

// pgvector literal helper
function toVectorLiteral(vec: number[]): string {
  // only finite numbers; anything else → 0
  return `[${vec.map(v => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

// helper: download bytes from R2
async function downloadBytes(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body: any = res.Body;

  // Node 18+ AWS SDK v3 has transformToByteArray(); fallback to stream -> buffer
  if (typeof body?.transformToByteArray === "function") return body.transformToByteArray();

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
  }
  // concat
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// deterministic placeholder: hash → repeat over EMBED_DIM, values ~ [-1, 1]
async function embed(bytes: Uint8Array): Promise<number[]> {
  const h = createHash("sha1").update(bytes).digest(); // 20 bytes
  const out = new Array(EMBED_DIM).fill(0);
  for (let i = 0; i < EMBED_DIM; i++) {
    out[i] = (h[i % h.length] / 255) * 2 - 1;
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

// --- SAFETY (stub) ---
type SafetyResult = { isSafe: boolean; nsfwScore: number; hasPerson?: boolean };

async function runSafety(bytes: Uint8Array): Promise<SafetyResult> {
  // TODO: replace with real model later
  return { isSafe: true, nsfwScore: 0.01, hasPerson: false };
}

async function handleSAFETY(storageKey: string) {
  const bytes = await downloadBytes(storageKey);
  const res = await runSafety(bytes);

  await prisma.gymEquipmentImage.updateMany({
    where: { storageKey },
    data: {
      isSafe: res.isSafe,
      nsfwScore: res.nsfwScore,
      hasPerson: res.hasPerson ?? null,
    },
  });
}

async function handleEMBED(storageKey: string) {
  // 1) locate the gym image row for this object
  const gymImg = await prisma.gymEquipmentImage.findFirst({
    where: { storageKey },
    select: { id: true, gymId: true },
  });
  if (!gymImg) throw new Error("GymEquipmentImage not found for storageKey");

  // 2) scope is gym-specific
  const scope = `GYM:${gymImg.gymId}`;

  // 3) skip if embedding exists for this (gymImageId, scope, model*)
  const existing = await prisma.imageEmbedding.findFirst({
    where: {
      gymImageId: gymImg.id,
      scope,
      modelVendor: EMBED_VENDOR,
      modelName: EMBED_MODEL,
      modelVersion: EMBED_VERSION,
    },
    select: { id: true },
  });
  if (existing) return;

  // 4) compute vector
  const bytes = await downloadBytes(storageKey);
  const vec = await embed(bytes); // number[], length = EMBED_DIM

  // 5) upsert metadata row (no vector yet)
  const row = await (prisma.imageEmbedding as any).upsert({
    where: {
      gymImageId_scope_modelVendor_modelName_modelVersion: {
        gymImageId: gymImg.id,
        scope,
        modelVendor: EMBED_VENDOR,
        modelName: EMBED_MODEL,
        modelVersion: EMBED_VERSION,
      },
    },
    update: { dim: EMBED_DIM },
    create: {
      gymImageId: gymImg.id,
      scope,
      modelVendor: EMBED_VENDOR,
      modelName: EMBED_MODEL,
      modelVersion: EMBED_VERSION,
      dim: EMBED_DIM,
    },
    select: { id: true },
  });

  // 6) write vector (pgvector) via raw SQL
  const literal = toVectorLiteral(vec);
  await prisma.$executeRawUnsafe(
    `UPDATE "ImageEmbedding" SET "embeddingVec" = ${literal} WHERE id = $1`,
    row.id
  );
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const once = argv.includes("--once");
  const maxArg = argv.find(a => a.startsWith("--max="));
  const max = maxArg ? Number(maxArg.split("=")[1]) || 50 : 50;
  return { once, max };
}

async function processOnce() {
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
  const jobs = await queue.claimBatch(concurrency);

  await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.storageKey) {
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
              throw new Error(`Unsupported jobType for storageKey: ${job.jobType}`);
          }
        } else {
          throw new Error("Job missing storageKey (promotion path not implemented yet)");
        }

        await queue.markDone(job.id);
      } catch (err) {
        await queue.markFailed(job.id, err, 30);
      }
    })
  );
}

async function runForever() {
  const intervalMs = 2000;
  for (;;) {
    await processOnce();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function runOnce(maxLoops: number) {
  let loops = 0;
  while (loops < maxLoops) {
    const before = loops;
    await processOnce();
    loops += 1;
    // crude “no more work” breaker: if we didn’t claim anything, break
    // (processOnce() will be fast if queue is empty)
    if (loops === before) break;
  }
}

(async function main() {
  const { once, max } = parseArgs();
  if (once) {
    await runOnce(max);
    process.exit(0);
  } else {
    await runForever();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
