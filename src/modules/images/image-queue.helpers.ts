import { kickBurstRunner } from './image-worker';
import { priorityFromSource } from './queue.service';
import { ImageJobStatus, PrismaClient } from '../../prisma';

type QueueSource = 'recognition_user' | 'gym_manager' | 'admin' | 'backfill' | 'gym_equipment';

export async function queueImageProcessingForStorageKey({
  prisma,
  storageKey,
  gymImageId,
  source = 'gym_manager',
}: {
  prisma: PrismaClient;
  storageKey: string | null | undefined;
  gymImageId?: string | null;
  source?: QueueSource;
}) {
  const key = storageKey?.trim();
  if (!key && !gymImageId) return false;

  const orClauses = [] as { storageKey?: string; gymImageId?: string }[];
  if (key) orClauses.push({ storageKey: key });
  if (gymImageId) orClauses.push({ gymImageId });

  const existing = await prisma.imageQueue.findFirst({
    where: {
      status: { in: [ImageJobStatus.pending, ImageJobStatus.processing] },
      ...(orClauses.length ? { OR: orClauses } : {}),
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.imageQueue.create({
    data: {
      jobType: 'HASH',
      status: ImageJobStatus.pending,
      priority: priorityFromSource(source),
      storageKey: key ?? undefined,
      gymImageId: gymImageId ?? undefined,
    },
  });

  setImmediate(() => {
    kickBurstRunner().catch((err) => console.error('burst runner error', err));
  });

  return true;
}
