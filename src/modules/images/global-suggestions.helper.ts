import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { PrismaClient } from '../../prisma';
import { fileExtFrom } from '../../utils/makeKey';

const DEFAULT_BUCKET = process.env.R2_BUCKET!;
if (!DEFAULT_BUCKET) throw new Error('R2_BUCKET must be set');

export function parsePgvectorText(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const s = v.trim();
  if (s.length < 2 || s[0] !== '[' || s[s.length - 1] !== ']') return null;
  const parts = s.slice(1, -1).split(',');
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export type GlobalCandidateScoreInput = {
  globalCount: number;
  hiRes: boolean;
  simMax: number;
};

export function scoreGlobalCandidate({ globalCount, hiRes, simMax }: GlobalCandidateScoreInput) {
  let s = 0;
  const reasons: string[] = [];
  if (globalCount === 0) {
    s += 0.6;
    reasons.push('NO_GLOBAL');
  } else if (globalCount < 3) {
    s += 0.3;
    reasons.push('LOW_COVERAGE');
  } else if (globalCount < 15) {
    s += 0.15;
    reasons.push('GROWTH');
  }
  if (hiRes) {
    s += 0.1;
    reasons.push('HI_RES');
  }
  s += 0.05;
  reasons.push('FRESH');
  if (simMax >= 0.995) {
    s -= 0.5;
    reasons.push('NEAR_DUP_STRONG');
  } else if (simMax >= 0.985) {
    s -= 0.25;
    reasons.push('NEAR_DUP');
  }
  return { score: Math.max(0, Math.min(1, s)), reasons };
}

export type MaybeSuggestDeps = {
  prisma: PrismaClient;
  s3: S3Client;
  bucket?: string;
};

export type MaybeSuggestParams = {
  equipmentId: number;
  gymImageId: string;
  storageKey: string | null | undefined;
  sha256: string | null | undefined;
  vector: ArrayLike<number> | null | undefined;
};

async function s3CopyIfMissing(s3: S3Client, bucket: string, srcKey: string, dstKey: string) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: dstKey }));
    return;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
  }
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${srcKey}`,
      Key: dstKey,
      MetadataDirective: 'COPY',
      ACL: 'private',
    }),
  );
}

export async function maybeSuggestGlobalFromGymImage(
  deps: MaybeSuggestDeps,
  params: MaybeSuggestParams,
) {
  const bucket = deps.bucket ?? DEFAULT_BUCKET;
  if (!bucket) throw new Error('R2 bucket missing');

  const vector = params.vector ? Array.from(params.vector) : null;
  const sha256 = params.sha256?.trim();
  const storageKey = params.storageKey?.trim();
  const equipmentId = params.equipmentId;
  const gymImageId = params.gymImageId;

  if (!sha256 || !vector || vector.length === 0) return;
  if (!storageKey) return;

  const dup = await deps.prisma.equipmentImage.findFirst({
    where: { sha256 },
    select: { id: true },
  });
  if (dup) return;

  const globalCount = await deps.prisma.equipmentImage.count({
    where: { equipmentId },
  });
  if (globalCount >= 15) return;

  const ext = fileExtFrom(storageKey);
  const globalCandKey = `private/global/candidates/${equipmentId}/${sha256}.${ext}`;
  await s3CopyIfMissing(deps.s3, bucket, storageKey, globalCandKey);

  const rows = await deps.prisma.$queryRawUnsafe<{ id: string; v: string }[]>(
    `SELECT id, embedding::text AS v FROM "EquipmentImage" WHERE "equipmentId" = $1 LIMIT 200`,
    equipmentId,
  );
  let simMax = 0;
  let nearDupId: string | null = null;
  for (const row of rows) {
    const vec = parsePgvectorText(row.v);
    if (!vec) continue;
    const c = cosine(vector, vec);
    if (c > simMax) {
      simMax = c;
      nearDupId = row.id;
    }
  }

  let hiRes = false;
  try {
    const head = await deps.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    hiRes = (head.ContentLength ?? 0) >= 300 * 1024;
  } catch (err) {
    if ((err as any)?.$metadata?.httpStatusCode !== 404) {
      console.warn('Failed to determine image resolution from storage key', err);
    }
  }

  const { score, reasons } = scoreGlobalCandidate({
    globalCount,
    hiRes,
    simMax,
  });

  await deps.prisma.globalImageSuggestion.upsert({
    where: { sha256 },
    update: {
      storageKey: globalCandKey,
      usefulnessScore: score,
      reasonCodes: reasons,
      status: 'PENDING',
      nearDupImageId: simMax >= 0.985 ? nearDupId : null,
    },
    create: {
      equipmentId,
      gymImageId,
      storageKey: globalCandKey,
      sha256,
      usefulnessScore: score,
      reasonCodes: reasons,
      status: 'PENDING',
      nearDupImageId: simMax >= 0.985 ? nearDupId : null,
    },
  });
}
