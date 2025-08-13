import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseKey } from "../utils/makeKey";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) {
  throw new Error("R2_BUCKET and R2_ACCOUNT_ID must be set");
}

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function clampTtl(ttlSec: number) {
  // S3/R2 max ~ 7 days (604800). Keep sane bounds.
  const MIN = 30;
  const MAX = 604800;
  return Math.max(MIN, Math.min(ttlSec, MAX));
}

export class MediaService {
  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  /**
   * Build a pre-signed GET URL for a storageKey.
   * Optionally enforces prefix allowlist and sets response headers.
   */
  async presignGetForKey(storageKey: string, ttlSec = 300): Promise<string> {
    // Basic safety: only allow our three prefixes
    if (
      !(
        storageKey.startsWith("public/golden/") ||
        storageKey.startsWith("public/training/") ||
        storageKey.startsWith("private/uploads/")
      )
    ) {
      throw new Error("Invalid storage key prefix");
    }

    const parsed = parseKey(storageKey);
    const ext = parsed?.ext ?? "jpg";
    const ResponseContentType = contentTypeFromExt(ext);

    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      // Optional: force inline display and content type in the response
      ResponseContentType,
      ResponseContentDisposition: `inline; filename="${storageKey
        .split("/")
        .pop()}"`,
      // You can also set ResponseCacheControl here if desired
    });

    const url = await getSignedUrl(this.s3, cmd, { expiresIn: clampTtl(ttlSec) });
    return url;
  }
}