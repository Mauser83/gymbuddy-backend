import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID, createHash } from 'crypto';
import { GraphQLError } from 'graphql';

import { assertSizeWithinLimit } from './media.utils';
import { makeKey, parseKey } from '../../utils/makeKey';
import { AuditService } from '../core/audit.service';
import { DIContainer } from '../core/di.container';

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) {
  throw new Error('R2_BUCKET and R2_ACCOUNT_ID must be set');
}

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function clampTtl(ttlSec: number) {
  // S3/R2 max ~ 7 days (604800). Keep sane bounds.
  const MIN = 30;
  const MAX = 604800;
  return Math.max(MIN, Math.min(ttlSec, MAX));
}

function extFromContentType(ct: string): 'jpg' | 'png' | 'webp' {
  if (/jpeg/i.test(ct)) return 'jpg';
  if (/png/i.test(ct)) return 'png';
  if (/webp/i.test(ct)) return 'webp';
  return 'jpg';
}

export class MediaService {
  private s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private signCounts: Map<number, { count: number; reset: number }> = new Map();

  private uploadKeyBySha: Map<string, string> = new Map();

  private clampShortTtl(ttlSec?: number) {
    const MIN = 30;
    const MAX = 900;
    const ttl = ttlSec ?? 300;
    return Math.max(MIN, Math.min(ttl, MAX));
  }

  private checkRateLimit(userId: number) {
    const now = Date.now();
    const bucket = this.signCounts.get(userId);
    if (!bucket || now > bucket.reset) {
      this.signCounts.set(userId, { count: 1, reset: now + 60_000 });
      return;
    }
    if (bucket.count >= 60) {
      throw new GraphQLError('Too many requests', {
        extensions: { code: 'TOO_MANY_REQUESTS' },
      });
    }
    bucket.count += 1;
  }

  /**
   * Build a pre-signed GET URL for a storageKey.
   * Optionally enforces prefix allowlist and sets response headers.
   */
  async presignGetForKey(storageKey: string, ttlSec = 300): Promise<string> {
    // Basic safety: only allow known prefixes
    if (
      !(
        storageKey.startsWith('public/golden/') ||
        storageKey.startsWith('public/training/') ||
        storageKey.startsWith('private/uploads/') ||
        storageKey.startsWith('private/uploads/global/') ||
        storageKey.startsWith('private/gym/') ||
        storageKey.startsWith('private/global/') ||
        storageKey.startsWith('private/recognition/')
      )
    ) {
      throw new Error('Invalid storage key prefix');
    }

    const parsed = parseKey(storageKey);
    const ext = parsed?.ext ?? 'jpg';
    const ResponseContentType = contentTypeFromExt(ext);

    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      // Optional: force inline display and content type in the response
      ResponseContentType,
      ResponseContentDisposition: `inline; filename="${storageKey.split('/').pop()}"`,
      // You can also set ResponseCacheControl here if desired
    });

    const url = await getSignedUrl(this.s3, cmd, { expiresIn: clampTtl(ttlSec) });
    return url;
  }

  /**
   * Sign a PUT for client direct upload.
   * Returns the url + the exact headers the client MUST send.
   */
  async getImageUploadUrl(input: {
    gymId: number;
    contentType: string;
    filename?: string;
    sha256?: string;
    contentLength?: number;
    ttlSec?: number;
  }) {
    assertSizeWithinLimit(input.contentLength);

    const ttl = clampTtl(input.ttlSec ?? 300);
    const ext = extFromContentType(input.contentType);

    let key: string;
    if (input.sha256) {
      const mapKey = `${input.gymId}:${input.sha256}`;
      const existingKey = this.uploadKeyBySha.get(mapKey);
      if (existingKey) {
        key = existingKey;
      } else {
        key = makeKey('upload', { gymId: input.gymId }, { ext });
        this.uploadKeyBySha.set(mapKey, key);
      }
    } else {
      key = makeKey('upload', { gymId: input.gymId }, { ext });
    }

    let alreadyUploaded = false;
    if (input.sha256) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        alreadyUploaded = true;
      } catch (err: any) {
        if (err?.$metadata?.httpStatusCode !== 404) throw err;
      }
    }

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: input.contentType,
      ContentDisposition: input.filename ? `inline; filename="${input.filename}"` : undefined,
    });

    const url = await getSignedUrl(this.s3, cmd, { expiresIn: ttl });
    const expiresAtMs = Date.now() + ttl * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();

    return {
      url,
      key,
      expiresAt,
      expiresAtMs,
      alreadyUploaded,
      requiredHeaders: [{ name: 'Content-Type', value: input.contentType }],
    };
  }

  async createUploadSession(input: {
    gymId: number;
    count: number;
    contentTypes: string[];
    filenamePrefix?: string;
    equipmentId?: number;
  }) {
    if (input.count < 1 || input.count > 10) throw new Error('count must be between 1 and 10');
    if (input.contentTypes.length !== input.count)
      throw new Error('contentTypes length must equal count');

    const ttl = 900; // ~15 minutes
    const expiresAtMs = Date.now() + ttl * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();

    const items = await Promise.all(
      input.contentTypes.map(async (ct) => {
        const presign = await this.getImageUploadUrl({
          gymId: input.gymId,
          contentType: ct,
          filename: input.filenamePrefix,
          ttlSec: ttl,
        });
        return {
          url: presign.url,
          storageKey: presign.key,
          expiresAt: presign.expiresAt,
          expiresAtMs: presign.expiresAtMs,
          alreadyUploaded: presign.alreadyUploaded,
          requiredHeaders: presign.requiredHeaders,
        };
      }),
    );

    return {
      sessionId: randomUUID(),
      items,
      expiresAt,
      expiresAtMs,
    };
  }

  async imageUrlMany(storageKeys: string[], ttlSec = 600) {
    return Promise.all(
      storageKeys.map(async (key) => {
        const url = await this.presignGetForKey(key, ttlSec);
        const expiresAt = new Date(Date.now() + clampTtl(ttlSec) * 1000).toISOString();
        return { storageKey: key, url, expiresAt };
      }),
    );
  }

  async imageUrl(
    storageKey: string,
    ttlSec = 300,
    actorId?: number | null,
  ): Promise<{ url: string; expiresAt: string }> {
    this.checkRateLimit(actorId ?? 0);
    const ttl = this.clampShortTtl(ttlSec);

    if (storageKey.startsWith('private/')) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }));
      } catch (err: any) {
        if (err?.$metadata?.httpStatusCode === 404) {
          throw new GraphQLError('Object not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
        throw err;
      }
    }

    const url = await this.presignGetForKey(storageKey, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const audit = DIContainer.resolve<AuditService>('AuditService');
    const keyHash = createHash('sha256').update(storageKey).digest('hex');
    await audit.logEvent({
      action: 'SIGNED_URL_ISSUED',
      userId: actorId ?? undefined,
      metadata: { keyHash, ttlSec: ttl },
    });

    return { url, expiresAt };
  }
}

// --- storage helpers ---
const helperS3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function copyObjectIfMissing(srcKey: string, dstKey: string): Promise<void> {
  try {
    await helperS3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: dstKey }));
    return; // destination exists
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
  }
  await helperS3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${srcKey}`,
      Key: dstKey,
      MetadataDirective: 'COPY',
      ACL: 'private',
    }),
  );
}

export async function deleteObjectIgnoreMissing(key: string): Promise<void> {
  try {
    await helperS3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
  }
}
