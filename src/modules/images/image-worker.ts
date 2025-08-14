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
          switch (job.jobType) {
            case "HASH":
              await handleHASH(job.storageKey);
              break;
            // SAFETY and EMBED will arrive in Steps 4 and 5
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
