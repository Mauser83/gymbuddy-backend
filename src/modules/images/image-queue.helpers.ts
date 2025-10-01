import { kickBurstRunner } from './image-worker';
import { priorityFromSource } from './queue.service';
import { ImageJobStatus, PrismaClient } from '../../prisma';

type QueueSource = 'recognition_user' | 'gym_manager' | 'admin' | 'backfill' | 'gym_equipment';

export async function queueImageProcessingForStorageKey({
  prisma,
  storageKey,
  source = 'gym_manager',
}: {
  prisma: PrismaClient;
  storageKey: string | null | undefined;
  source?: QueueSource;
}) {
  const key = storageKey?.trim();
  if (!key) return false;

  const existing = await prisma.imageQueue.findFirst({
    where: {
      storageKey: key,
      status: { in: [ImageJobStatus.pending, ImageJobStatus.processing] },
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.imageQueue.create({
    data: {
      jobType: 'HASH',
      status: ImageJobStatus.pending,
      priority: priorityFromSource(source),
      storageKey: key,
    },
  });

  setImmediate(() => {
    kickBurstRunner().catch((err) => console.error('burst runner error', err));
  });

  return true;
}
