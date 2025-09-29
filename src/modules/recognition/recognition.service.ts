import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID, createHmac, createHash } from 'crypto';

import { ImageJobStatus, prisma } from '../../prisma';
import { knnFromVectorGlobal, knnFromVectorGym } from '../cv/knn.service';
import {
  embedImage,
  initLocalOpenCLIP,
  EMBEDDING_DIM,
} from '../images/embedding/local-openclip-light';
import { kickBurstRunner } from '../images/image-worker';
import { priorityFromSource } from '../images/queue.service';
import type { UploadTicketInput } from '../media/media.types';
import { assertSizeWithinLimit } from '../media/media.utils';

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const TICKET_SECRET = process.env.TICKET_SECRET!;
const T_HIGH = 0.85;

const EXT_WHITELIST = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);

export function inferContentType(ext: string) {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

const PER_EQUIPMENT_IMAGES = 3;
const OVERSAMPLE_FACTOR = 10;
const SEARCH_TOPK_MAX = 200;
type Img = {
  equipmentId: number;
  gymId?: number | null;
  storageKey: string;
  score: number;
  imageId: string;
};

type CandidateImage = {
  imageId: string;
  equipmentId: number;
  gymId?: number | null;
  storageKey: string;
  score: number;
};

type EquipmentCandidate = {
  equipmentId: number;
  equipmentName?: string | null;
  topScore: number;
  representative: CandidateImage;
  images: CandidateImage[];
  source: string;
  totalImagesConsidered: number;
  lowConfidence: boolean;
};

type RecognitionDecision = 'GYM_ACCEPT' | 'GLOBAL_ACCEPT' | 'REJECT';

export function groupTopEquipment(
  imgs: Img[],
  options: { keepPerEq?: number; source?: string; totalImages?: number } = {},
): EquipmentCandidate[] {
  const { keepPerEq = PER_EQUIPMENT_IMAGES, source = 'GYM', totalImages = imgs.length } = options;
  if (!imgs?.length) return [];
  const sorted = [...imgs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const buckets = new Map<number, Img[]>();
  for (const it of sorted) {
    const arr = buckets.get(it.equipmentId) ?? [];
    if (arr.length < keepPerEq) arr.push(it);
    buckets.set(it.equipmentId, arr);
  }
  return Array.from(buckets.entries())
    .map(([equipmentId, items]) => ({
      equipmentId,
      equipmentName: undefined,
      topScore: items[0].score ?? 0,
      representative: {
        imageId: items[0].imageId,
        equipmentId,
        gymId: items[0].gymId ?? null,
        storageKey: items[0].storageKey,
        score: items[0].score,
      },
      images: items.map((it) => ({
        imageId: it.imageId,
        equipmentId: it.equipmentId,
        gymId: it.gymId ?? null,
        storageKey: it.storageKey,
        score: it.score,
      })),
      source,
      totalImagesConsidered: totalImages,
      lowConfidence: (items[0].score ?? 0) < 0.7,
    }))
    .sort((a, b) => b.topScore - a.topScore);
}

export class RecognitionService {
  private s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  private embedInit = initLocalOpenCLIP();

  private sign(payload: any) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', TICKET_SECRET).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verify(token: string) {
    const [body, sig] = token.split('.');
    const expected = createHmac('sha256', TICKET_SECRET).update(body).digest('base64url');
    if (expected !== sig) throw new Error('Invalid ticketToken');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('ticketToken expired');
    }
    return payload as { gid: number; key: string };
  }

  private async downloadBytes(key: string): Promise<Uint8Array> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body: any = res.Body;
    if (typeof body?.transformToByteArray === 'function') return body.transformToByteArray();
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }

  private async prepareVectorForTicket(token: string) {
    const { gid: gymId, key: storageKey } = this.verify(token);
    await this.s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey })).catch(() => {
      throw new Error('Uploaded object not found');
    });

    await this.embedInit;
    const bytes = await this.downloadBytes(storageKey);
    const vecF32 = await embedImage(Buffer.from(bytes));
    const vector = Array.from(vecF32);
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
      throw new Error('Embedding failed');
    }

    const vecBuf = Buffer.from(vecF32.buffer);
    const vectorHash = createHash('sha256').update(vecBuf).digest('hex').slice(0, 16);

    return { gymId, storageKey, vector, vectorHash };
  }

  private mapRowsToCandidates(
    rows: { id: string; equipmentId: number | null; storageKey: string; score: number }[],
    options: { gymId: number | null },
  ): CandidateImage[] {
    const { gymId } = options;
    return rows
      .filter((r) => r.equipmentId != null)
      .map((r) => ({
        imageId: r.id,
        equipmentId: r.equipmentId!,
        gymId,
        storageKey: r.storageKey,
        score: r.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private async hydrateEquipmentNames(candidates: EquipmentCandidate[]) {
    if (!candidates.length) return;
    const ids = Array.from(new Set(candidates.map((c) => c.equipmentId)));
    if (!ids.length) return;
    const eqMap = await prisma.equipment
      .findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      .then((rows) => new Map(rows.map((r) => [r.id, r.name])));
    candidates.forEach((c) => {
      c.equipmentName = eqMap.get(c.equipmentId) ?? null;
    });
  }

  private async createAttemptRecord(params: {
    gymId: number;
    storageKey: string;
    vectorHash: string;
    decision: RecognitionDecision;
    bestEquipmentId: number | null;
    bestScore: number;
  }) {
    const attempt = await prisma.recognitionAttempt.create({
      data: {
        gymId: params.gymId,
        storageKey: params.storageKey,
        vectorHash: params.vectorHash,
        bestEquipmentId: params.bestEquipmentId,
        bestScore: params.bestScore,
        decision: params.decision,
        consent: 'unknown',
      },
    });

    return {
      attemptId: String(attempt.id),
      storageKey: attempt.storageKey,
      vectorHash: attempt.vectorHash,
      bestEquipmentId: attempt.bestEquipmentId,
      bestScore: attempt.bestScore,
      createdAt: attempt.createdAt,
      decision: attempt.decision,
    };
  }

  async createUploadTicket(gymId: number, upload: UploadTicketInput) {
    assertSizeWithinLimit(upload.contentLength);
    const ext = upload.ext.trim().toLowerCase();
    if (!EXT_WHITELIST.has(ext)) throw new Error('Unsupported image extension');

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const uuid = randomUUID();
    const storageKey = `private/recognition/${gymId}/${yyyy}/${mm}/${uuid}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ContentType: upload.contentType || inferContentType(ext),
    });
    const ttl = 600; // 10 min
    const putUrl = await getSignedUrl(this.s3, cmd, { expiresIn: ttl });
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const payload = {
      v: 1,
      gid: gymId,
      key: storageKey,
      exp: Math.floor(Date.now() / 1000) + ttl,
    };
    const ticketToken = this.sign(payload);

    return { ticketToken, storageKey, putUrl, expiresAt };
  }

  async recognizeImage(token: string, limit = 3) {
    const { gymId, storageKey, vector, vectorHash } = await this.prepareVectorForTicket(token);

    const N = Math.max(1, Math.min(limit ?? 3, 10));
    const searchTopK = Math.min(SEARCH_TOPK_MAX, N * PER_EQUIPMENT_IMAGES * OVERSAMPLE_FACTOR);

    const [gymRows, globalRows] = await Promise.all([
      knnFromVectorGym({ vector, gymId, limit: searchTopK }),
      knnFromVectorGlobal({ vector, limit: searchTopK, gymId }),
    ]);

    const gymImages = this.mapRowsToCandidates(gymRows, { gymId });
    const globalImages = this.mapRowsToCandidates(globalRows, { gymId: null });

    const gymTop = gymImages[0];
    const globalTop = globalImages[0];

    let decision: RecognitionDecision = 'REJECT';
    if (gymTop && (!globalTop || gymTop.score >= globalTop.score) && gymTop.score >= T_HIGH) {
      decision = 'GYM_ACCEPT';
    } else if (globalTop && globalTop.score >= T_HIGH) {
      decision = 'GLOBAL_ACCEPT';
    }

    let chosen: CandidateImage[] = [];
    let sourceTag = 'DECISION';
    if (decision === 'GYM_ACCEPT') {
      chosen = gymImages;
      sourceTag = 'GYM';
    } else if (decision === 'GLOBAL_ACCEPT') {
      chosen = globalImages;
      sourceTag = 'GLOBAL';
    }

    if (decision !== 'REJECT' && chosen.length === 0) {
      const alt = decision === 'GYM_ACCEPT' ? globalImages : gymImages;
      if (alt.length) {
        chosen = alt;
        sourceTag = 'DECISION';
      }
    }

    let equipmentCandidates = groupTopEquipment(chosen, {
      source: sourceTag,
      totalImages: chosen.length,
    }).slice(0, N);

    let bestEquipmentId = equipmentCandidates[0]?.equipmentId ?? null;
    let bestScore = equipmentCandidates[0]?.topScore ?? 0;

    if (decision !== 'REJECT' && equipmentCandidates.length === 0) {
      const fallbackBest =
        decision === 'GYM_ACCEPT' ? (gymTop ?? globalTop) : (globalTop ?? gymTop);
      if (fallbackBest) {
        bestEquipmentId = fallbackBest.equipmentId;
        bestScore = fallbackBest.score;
        const rep = gymImages
          .concat(globalImages)
          .find((i) => i.equipmentId === fallbackBest.equipmentId) ?? {
          imageId: 'synthetic',
          equipmentId: fallbackBest.equipmentId,
          gymId: decision === 'GYM_ACCEPT' ? gymId : null,
          storageKey,
          score: bestScore,
        };
        equipmentCandidates = [
          {
            equipmentId: fallbackBest.equipmentId,
            equipmentName: undefined,
            topScore: bestScore,
            representative: rep,
            images: [rep],
            source: 'ATTEMPT',
            totalImagesConsidered: gymImages.length + globalImages.length,
            lowConfidence: bestScore < 0.7,
          },
        ];
      }
    }

    await this.hydrateEquipmentNames(equipmentCandidates);

    const attempt = await this.createAttemptRecord({
      gymId,
      storageKey,
      vectorHash,
      decision,
      bestEquipmentId,
      bestScore,
    });

    console.log('recognizeImage:', {
      gymTop: gymTop ? { equipmentId: gymTop.equipmentId, score: gymTop.score } : null,
      globalTop: globalTop ? { equipmentId: globalTop.equipmentId, score: globalTop.score } : null,
      decision,
      best: { equipmentId: bestEquipmentId, score: bestScore },
      equipCandidates: equipmentCandidates.map((c) => ({
        equipmentId: c.equipmentId,
        topScore: c.topScore,
        source: c.source,
      })),
      counts: { gymImages: gymImages.length, globalImages: globalImages.length },
    });

    return {
      attempt,
      gymCandidates: gymImages,
      globalCandidates: globalImages,
      equipmentCandidates,
    };
  }

  async recognizeCatalogEquipmentByTicket(ticketToken: string, limit = 5) {
    const { gymId, storageKey, vector, vectorHash } =
      await this.prepareVectorForTicket(ticketToken);

    const N = Math.max(1, Math.min(limit ?? 5, 10));
    const searchTopK = Math.min(SEARCH_TOPK_MAX, N * PER_EQUIPMENT_IMAGES * OVERSAMPLE_FACTOR);

    const globalRows = await knnFromVectorGlobal({ vector, limit: searchTopK });
    const globalImages = this.mapRowsToCandidates(globalRows, { gymId: null });

    const equipmentCandidates = groupTopEquipment(globalImages, {
      source: 'GLOBAL',
      totalImages: globalImages.length,
    }).slice(0, N);

    let decision: RecognitionDecision = 'REJECT';
    let bestEquipmentId: number | null = null;
    let bestScore = 0;

    if (equipmentCandidates.length) {
      decision = 'GLOBAL_ACCEPT';
      bestEquipmentId = equipmentCandidates[0].equipmentId ?? null;
      bestScore = equipmentCandidates[0].topScore ?? 0;
    }

    await this.hydrateEquipmentNames(equipmentCandidates);

    const attempt = await this.createAttemptRecord({
      gymId,
      storageKey,
      vectorHash,
      decision,
      bestEquipmentId,
      bestScore,
    });

    console.log('recognizeCatalogEquipmentByTicket:', {
      decision,
      best: { equipmentId: bestEquipmentId, score: bestScore },
      totalCandidates: equipmentCandidates.length,
      totalImages: globalImages.length,
    });

    return {
      attempt,
      globalCandidates: globalImages,
      gymCandidates: [],
      equipmentCandidates,
    };
  }

  async confirmRecognition(input: {
    attemptId: bigint;
    selectedEquipmentId: number;
    offerForTraining: boolean;
    uploaderUserId: number | null;
  }) {
    const attempt = await prisma.recognitionAttempt.findUnique({
      where: { id: input.attemptId },
    });
    if (!attempt) throw new Error('Attempt not found');

    const gymEquipment = await prisma.gymEquipment.findFirst({
      where: {
        gymId: attempt.gymId,
        equipmentId: input.selectedEquipmentId,
      },
    });
    if (!gymEquipment) throw new Error('Selected equipment is not part of this gym');

    await prisma.recognitionAttempt.update({
      where: { id: input.attemptId },
      data: {
        consent: input.offerForTraining ? 'granted' : 'denied',
        bestEquipmentId: input.selectedEquipmentId,
      },
    });

    if (input.offerForTraining) {
      const parts = attempt.storageKey.split('.');
      const ext = parts[parts.length - 1] || 'jpg';
      const candidatesKey = `private/gym/${gymEquipment.id}/candidates/${randomUUID()}.${ext}`;

      await this.s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `/${BUCKET}/${attempt.storageKey}`,
          Key: candidatesKey,
        }),
      );

      const tc = await prisma.trainingCandidate.create({
        data: {
          gymId: attempt.gymId,
          gymEquipmentId: gymEquipment.id,
          storageKey: candidatesKey,
          status: 'pending',
          source: 'user_submission',
          uploaderUserId: input.uploaderUserId ?? null,
          capturedAt: new Date(attempt.createdAt),
          recognitionScoreAtCapture: attempt.bestScore ?? null,
        } as any,
        select: { id: true, storageKey: true },
      });

      await prisma.imageQueue.create({
        data: {
          jobType: 'HASH',
          status: ImageJobStatus.pending,
          priority: priorityFromSource('recognition_user'),
          storageKey: tc.storageKey,
        },
      });
      setImmediate(() =>
        kickBurstRunner({ maxRuntimeMs: 300_000, idleExitMs: 4_000, batchSize: 1 }).catch(
          console.error,
        ),
      );
    }

    return { saved: true };
  }

  async discardRecognition(attemptId: bigint) {
    const attempt = await prisma.recognitionAttempt.update({
      where: { id: attemptId },
      data: { consent: 'denied' },
    });
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: attempt.storageKey }));
    } catch (err) {
      if ((err as any)?.$metadata?.httpStatusCode !== 404) {
        console.warn('Failed to delete recognition attempt object', err);
      }
    }
    return true;
  }
}
