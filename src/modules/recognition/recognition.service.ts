import { randomUUID, createHmac, createHash } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../../lib/prisma";
import {
  embedImage,
  initLocalOpenCLIP,
  EMBEDDING_DIM,
} from "../images/embedding/local-openclip-light";
import { knnFromVectorGlobal, knnFromVectorGym } from "../cv/knn.service";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const TICKET_SECRET = process.env.TICKET_SECRET ?? "test-secret";
const T_HIGH = 0.85;
const T_LOW = 0.55;

const PER_EQUIPMENT_IMAGES = 3;
const OVERSAMPLE_FACTOR = 10;
const SEARCH_TOPK_MAX = 200;
const MIN_ALT_SCORE = Number(process.env.RECOG_MIN_ALT_SCORE ?? 0.0); // not used for filtering anymore
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

function groupTopEquipment(
  imgs: Img[],
  keepPerEq = PER_EQUIPMENT_IMAGES
): EquipmentCandidate[] {
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
      source: "GYM",
      totalImagesConsidered: items.length,
      lowConfidence: (items[0].score ?? 0) < 0.7,
    }))
    .sort((a, b) => b.topScore - a.topScore);
}

export class RecognitionService {
  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  private embedInit = initLocalOpenCLIP();

  private sign(payload: any) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", TICKET_SECRET)
      .update(body)
      .digest("base64url");
    return `${body}.${sig}`;
  }

  private verify(token: string) {
    const [body, sig] = token.split(".");
    const expected = createHmac("sha256", TICKET_SECRET)
      .update(body)
      .digest("base64url");
    if (expected !== sig) throw new Error("Invalid ticketToken");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error("ticketToken expired");
    }
    return payload as { gid: number; key: string };
  }

  private async downloadBytes(key: string): Promise<Uint8Array> {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const body: any = res.Body;
    if (typeof body?.transformToByteArray === "function")
      return body.transformToByteArray();
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

  async createUploadTicket(gymId: number, ext: string) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const uuid = randomUUID();
    const storageKey = `private/recognition/${gymId}/${yyyy}/${mm}/${uuid}.${ext}`;

    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: storageKey });
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

  async recognizeImage(token: string, limit = 5) {
    const { gid: gymId, key: storageKey } = this.verify(token);
    await this.s3
      .send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }))
      .catch(() => {
        throw new Error("Uploaded object not found");
      });

    await this.embedInit;
    const bytes = await this.downloadBytes(storageKey);
    const vecF32 = await embedImage(Buffer.from(bytes));
    const vector = Array.from(vecF32);
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
      throw new Error("Embedding failed");
    }

    const vecBuf = Buffer.from(vecF32.buffer);
    const vectorHash = createHash("sha256")
      .update(vecBuf)
      .digest("hex")
      .slice(0, 16);

    const N = Math.max(1, Math.min(limit ?? 3, 10));
    const searchTopK = Math.min(
      SEARCH_TOPK_MAX,
      N * PER_EQUIPMENT_IMAGES * OVERSAMPLE_FACTOR
    );

    const globalRows = await knnFromVectorGlobal({
      vector,
      limit: searchTopK,
      gymId,
    });
    const gTop = globalRows[0];
    let decision: "GLOBAL_ACCEPT" | "GYM_ACCEPT" | "GYM_SELECT" | "RETAKE" =
      "RETAKE";
    let bestEquipmentId: number | null = null;
    let bestScore = 0;

    if (gTop && gTop.score >= T_HIGH) {
      decision = "GLOBAL_ACCEPT";
      bestEquipmentId = gTop.equipmentId ?? null;
      bestScore = gTop.score;
    }

    let gymRows: typeof globalRows = [];
    if (decision !== "GLOBAL_ACCEPT") {
      gymRows = await knnFromVectorGym({
        vector,
        gymId,
        limit: searchTopK,
      });
      const top = gymRows[0];
      if (top && top.score >= T_HIGH) {
        decision = "GYM_ACCEPT";
        bestEquipmentId = top.equipmentId ?? null;
        bestScore = top.score;
      } else if (top && top.score >= T_LOW) {
        decision = "GYM_SELECT";
        bestEquipmentId = null;
        bestScore = top.score;
      } else {
        decision = "RETAKE";
        bestEquipmentId = null;
        bestScore = top?.score ?? 0;
      }
    }

    const attempt = await prisma.recognitionAttempt.create({
      data: {
        gymId,
        storageKey,
        vectorHash,
        bestEquipmentId,
        bestScore,
        consent: 'unknown',
      },
    });

    const mapRow = (r: any) => ({
      imageId: r.id,
      equipmentId: r.equipmentId ?? null,
      score: r.score,
      storageKey: r.storageKey,
    });

    const gymImages: Img[] = gymRows
      .filter((r) => r.equipmentId != null)
      .map((r) => ({
        equipmentId: r.equipmentId!,
        gymId,
        storageKey: r.storageKey,
        score: r.score,
        imageId: r.id,
      }));

    const globalImages: Img[] = globalRows
      .filter((r) => r.equipmentId != null)
      .map((r) => ({
        equipmentId: r.equipmentId!,
        gymId: null,
        storageKey: r.storageKey,
        score: r.score,
        imageId: r.id,
      }));

    const gymEq = groupTopEquipment(gymImages);

    gymEq.forEach((c) => (c.source = "GYM"));

    let eqCand = [...gymEq];
    if (eqCand.length < N) {
      const taken = new Set(eqCand.map((c) => c.equipmentId));
      const globalEq = groupTopEquipment(
        globalImages.filter((i) => !taken.has(i.equipmentId))
      );
      globalEq.forEach((c) => (c.source = "GLOBAL"));
      eqCand = [...eqCand, ...globalEq];
    }

    eqCand = eqCand.slice(0, N);

    if (eqCand.length) {
      const ids = eqCand.map((c) => c.equipmentId);
      const eqMap = await prisma.equipment
        .findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
        .then((rows) => new Map(rows.map((r) => [r.id, r.name])));
      eqCand.forEach((c) => {
        c.equipmentName = eqMap.get(c.equipmentId) ?? null;
      });
    }

    return {
      attempt: {
        attemptId: String(attempt.id),           // ← stringify
        storageKey: attempt.storageKey,
        vectorHash: attempt.vectorHash,
        bestEquipmentId: attempt.bestEquipmentId,
        bestScore: attempt.bestScore,
        createdAt: attempt.createdAt,
        decision,
      },
      globalCandidates: globalRows.map(mapRow),
      gymCandidates: gymRows.map(mapRow),
      equipmentCandidates: eqCand,
    };
  }

async confirmRecognition(input: {
    attemptId: bigint;
    selectedEquipmentId: number;
    offerForTraining: boolean;
  }) {
    const attempt = await prisma.recognitionAttempt.findUnique({
      where: { id: input.attemptId },
    });
    if (!attempt) throw new Error("Attempt not found");

    const gymEquipment = await prisma.gymEquipment.findFirst({
      where: {
        gymId: attempt.gymId,
        equipmentId: input.selectedEquipmentId,
      },
    });
    if (!gymEquipment)
      throw new Error("Selected equipment is not part of this gym");

    await prisma.recognitionAttempt.update({
      where: { id: input.attemptId },
      data: {
        consent: input.offerForTraining ? "granted" : "denied",
        bestEquipmentId: input.selectedEquipmentId,
      },
    });

    let promotedStorageKey: string | null = null;
    if (input.offerForTraining) {
      const parts = attempt.storageKey.split(".");
      const ext = parts[parts.length - 1] || "jpg";
      const targetKey = `private/uploads/${attempt.gymId}/training/${gymEquipment.id}/${randomUUID()}.${ext}`;

      await this.s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `/${BUCKET}/${attempt.storageKey}`,
          Key: targetKey,
        })
      );

      await prisma.trainingCandidate.create({
        data: {
          gymId: gymEquipment.gymId,
          gymEquipmentId: gymEquipment.id,
          storageKey: targetKey,
          source: "user_submission",
        },
      });

      promotedStorageKey = targetKey;
    }

    return { saved: true, promotedStorageKey };
  }

  async discardRecognition(attemptId: bigint) {
    const attempt = await prisma.recognitionAttempt.update({ where: { id: attemptId }, data: { consent: 'denied' } });
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: attempt.storageKey }));
    } catch {}
    return true;
  }
}