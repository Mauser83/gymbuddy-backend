import { randomUUID, createHmac } from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../lib/prisma';

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const TICKET_SECRET = process.env.TICKET_SECRET ?? 'test-secret';

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

  async createUploadTicket(gymId: number, ext: string) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const uuid = randomUUID();
    const storageKey = `private/recognition/${gymId}/${yyyy}/${mm}/${uuid}.${ext}`;

    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: storageKey });
    const ttl = 600; // 10 min
    const putUrl = await getSignedUrl(this.s3, cmd, { expiresIn: ttl });
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const payload = { v: 1, gid: gymId, key: storageKey, exp: Math.floor(Date.now() / 1000) + ttl };
    const ticketToken = this.sign(payload);

    return { ticketToken, storageKey, putUrl, expiresAt };
  }

  async recognizeImage(token: string, limit = 5) {
    const { gid, key } = this.verify(token);
    // ensure object exists
    await this.s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {
      throw new Error('Uploaded object not found');
    });

    // Placeholder: no real embedding or KNN yet
    const attempt = await prisma.recognitionAttempt.create({
      data: {
        gymId: gid,
        storageKey: key,
        vectorHash: 'placeholder',
        bestScore: 0,
        bestEquipmentId: null,
      },
    });

    return {
      attempt: {
        attemptId: attempt.id,
        storageKey: attempt.storageKey,
        vectorHash: attempt.vectorHash,
        bestEquipmentId: attempt.bestEquipmentId,
        bestScore: attempt.bestScore,
        createdAt: attempt.createdAt,
        decision: 'RETAKE',
      },
      globalCandidates: [],
      gymCandidates: [],
    };
  }

  async confirmRecognition(input: { attemptId: bigint; selectedEquipmentId: number; offerForTraining: boolean }) {
    const attempt = await prisma.recognitionAttempt.update({
      where: { id: input.attemptId },
      data: { consent: input.offerForTraining ? 'granted' : 'denied', bestEquipmentId: input.selectedEquipmentId },
    });

    let promotedStorageKey: string | null = null;
    if (input.offerForTraining) {
      await prisma.trainingCandidate.create({
        data: {
          attemptId: attempt.id,
          gymId: attempt.gymId,
          equipmentId: input.selectedEquipmentId,
          storageKey: attempt.storageKey,
          sourceScore: attempt.bestScore,
        },
      });
      promotedStorageKey = attempt.storageKey;
    }

    return { saved: true, promotedStorageKey };
  }

  async discardRecognition(attemptId: bigint) {
    await prisma.recognitionAttempt.update({ where: { id: attemptId }, data: { consent: 'denied' } });
    return true;
  }
}