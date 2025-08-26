import { promises as fs } from "fs";
import { dirname } from "path";
import { createHash } from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// ---- Sources: R2 (preferred) or direct URL ----
type Src = { kind: "r2"; bucket: string; key: string } | { kind: "url"; url: string };

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function fileExists(p: string) {
  try { await fs.stat(p); return true; } catch { return false; }
}

async function sha256File(p: string) {
  const buf = await fs.readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

async function downloadToFileFromR2(dstPath: string, bucket: string, key: string) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body: any = res.Body;
  const bytes = body?.transformToByteArray
    ? await body.transformToByteArray()
    : new Uint8Array(await new Response(body as any).arrayBuffer());
  await fs.writeFile(dstPath, bytes);
}

async function downloadToFileFromURL(dstPath: string, url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed ${resp.status} for ${url}`);
  const ab = await resp.arrayBuffer();
  await fs.writeFile(dstPath, Buffer.from(ab));
}

/**
 * Ensure a model file exists at modelPath. If missing, download from src.
 * Optionally verify a sha256 (hex) if provided.
 */
export async function ensureModelFile(
  modelPath: string,
  src: Src,
  expectedSha256?: string
) {
  if (await fileExists(modelPath)) {
    if (expectedSha256) {
      const got = await sha256File(modelPath);
      if (got.toLowerCase() !== expectedSha256.toLowerCase()) {
        // re-download on checksum mismatch
        await fs.rm(modelPath).catch(() => {});
      } else {
        return; // already good
      }
    } else {
      return;
    }
  }
  await ensureDir(dirname(modelPath));
  if (src.kind === "r2") {
    await downloadToFileFromR2(modelPath, src.bucket, src.key);
  } else {
    await downloadToFileFromURL(modelPath, src.url);
  }
  if (expectedSha256) {
    const got = await sha256File(modelPath);
    if (got.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error(`Checksum mismatch for ${modelPath}`);
    }
  }
}