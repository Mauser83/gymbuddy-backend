import type { PrismaClient } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma";
import { ImageJobStatus, GymImageStatus } from "../../generated/prisma";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { parseKey } from "../../utils/makeKey";
import { randomUUID } from "crypto";
import {
  copyObjectIfMissing,
  deleteObjectIgnoreMissing,
} from "../media/media.service";
import { kickBurstRunner } from "./image-worker";
import { priorityFromSource } from "./queue.service";
import {
  FinalizeGymImageDto,
  FinalizeGymImagesDto,
  ApplyTaxonomiesDto,
} from "../images/images.dto";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID)
  throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

function allowedContentType(ct?: string) {
  return !!ct && /^(image\/jpeg|image\/png|image\/webp)$/i.test(ct);
}

export class ImageIntakeService {
  constructor(private readonly prisma: PrismaClient) {}

  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private defaultTaxonomyIds: {
    sourceId: number | null;
    splitId: number | null;
    angleId: number | null;
    heightId: number | null;
    distanceId: number | null;
    lightingId: number | null;
    mirrorId: number | null;
  } | null = null;

  private async getDefaultTaxonomyIds() {
    if (!this.defaultTaxonomyIds) {
      const [source, split, angle, height, distance, lighting, mirror] =
        await Promise.all([
          this.prisma.sourceType.findFirst({
            where: { key: { equals: "mobile_app", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.splitType.findFirst({
            where: { key: { equals: "training", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.angleType.findFirst({
            where: { key: { equals: "unknown", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.heightType.findFirst({
            where: { key: { equals: "unknown", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.distanceType.findFirst({
            where: { key: { equals: "unknown", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.lightingType.findFirst({
            where: { key: { equals: "unknown", mode: "insensitive" } },
            select: { id: true },
          }),
          this.prisma.mirrorType.findFirst({
            where: { key: { equals: "unknown", mode: "insensitive" } },
            select: { id: true },
          }),
        ]);

      const ids = {
        sourceId: source?.id ?? null,
        splitId: split?.id ?? null,
        angleId: angle?.id ?? null,
        heightId: height?.id ?? null,
        distanceId: distance?.id ?? null,
        lightingId: lighting?.id ?? null,
        mirrorId: mirror?.id ?? null,
      };

      const missing = Object.entries(ids)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (missing.length) {
        throw new Error(
          `Missing default taxonomy IDs: ${missing.join(
            ", "
          )}. Seed keys must exist (mobile_app, training, unknown for angle/height/distance/lighting/mirror).`
        );
      }

      this.defaultTaxonomyIds = ids as {
        sourceId: number;
        splitId: number;
        angleId: number;
        heightId: number;
        distanceId: number;
        lightingId: number;
        mirrorId: number;
      };
    }
    return this.defaultTaxonomyIds;
  }

  async finalizeGymImage(input: FinalizeGymImageDto) {
    // 1) Validate key & gymId
    const parsed = parseKey(input.storageKey);
    if (!parsed || parsed.kind !== "upload")
      throw new Error("storageKey must be under private/uploads/...");
    if (parsed.gymId !== input.gymId)
      throw new Error("storageKey gymId does not match input.gymId");

// 2) Idempotency: return existing row if same sha256/object already finalized
    const existing = await this.prisma.gymEquipmentImage.findFirst({
      where: {
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        OR: [
          ...(input.sha256 ? [{ sha256: input.sha256 }] : []),
          { objectUuid: parsed.uuid },
        ],
      },
      select: {
        id: true,
        gymId: true,
        equipmentId: true,
        status: true,
        storageKey: true,
      },
    });
    if (existing) return { image: existing, queuedJobs: [] };

    // 3) HEAD the object
    const head = await this.s3
      .send(new HeadObjectCommand({ Bucket: BUCKET, Key: input.storageKey }))
      .catch((err) => {
        if (err?.$metadata?.httpStatusCode === 404)
          throw new Error("Uploaded object not found. Did the PUT succeed?");
        throw err;
      });

    const contentType = head.ContentType || "";
    const size = Number(head.ContentLength ?? 0);
    if (!allowedContentType(contentType))
      throw new Error(`Unsupported contentType: ${contentType}`);
    if (!(size > 0 && Number.isFinite(size)))
      throw new Error("Object size invalid or zero");

    // 4) Ensure gymEquipment join exists
    const join = await this.prisma.gymEquipment.upsert({
      where: {
        gymId_equipmentId: {
          gymId: input.gymId,
          equipmentId: input.equipmentId,
        },
      },
      update: {},
      create: { gymId: input.gymId, equipmentId: input.equipmentId },
    });

        // 5) Copy object to approved location and create DB row
    const approvedKey = `private/gym/${join.id}/approved/${randomUUID()}.${
      parsed.ext
    }`;
    await copyObjectIfMissing(input.storageKey, approvedKey);
    await deleteObjectIgnoreMissing(input.storageKey);

    const image = await this.prisma.gymEquipmentImage.create({
      data: {
        gymEquipmentId: join.id,
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        status: "PENDING",
        storageKey: approvedKey,
        sha256: input.sha256 ?? null,
        angleId: input.angleId ?? null,
        heightId: input.heightId ?? null,
        lightingId: input.lightingId ?? null,
        mirrorId: input.mirrorId ?? null,
        distanceId: input.distanceId ?? null,
        sourceId: input.sourceId ?? null,
        splitId: input.splitId ?? null,
        objectUuid: parsed.uuid,
      },
    });

    // 6) Enqueue HASH for gym upload (by approvedKey)
    const source: "recognition_user" = "recognition_user";
    const priority = priorityFromSource(source);
    const jobs: Prisma.ImageQueueCreateManyInput[] = input.sha256
      ? []
      : [
          {
            jobType: "HASH",
            status: ImageJobStatus.pending,
            priority,
            storageKey: approvedKey,
          },
        ];
    if (jobs.length) {
      await this.prisma.imageQueue.createMany({ data: jobs });
      setImmediate(() => {
        kickBurstRunner().catch((e) => console.error("burst runner error", e));
      });
    }
    return { image, queuedJobs: jobs.map((j) => j.jobType) };
  }

  async finalizeGymImagesAdmin(
    input: FinalizeGymImagesDto,
    userId: number | null
  ) {
    const { defaults, items } = input;
    const { gymId, equipmentId } = defaults;
    const priority = priorityFromSource("admin");
    const now = new Date();
    const tax = await this.getDefaultTaxonomyIds();

// Preflight: ensure join exists and copy objects outside txn
    const join = await this.prisma.gymEquipment.upsert({
      where: { gymId_equipmentId: { gymId, equipmentId } },
      update: {},
      create: { gymId, equipmentId },
    });

    type ReadyItem = {
      approvedKey: string;
      objectUuid: string;
      uploadKey: string;
      sha256?: string;
    };
    const ready: ReadyItem[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (it) => {
          try {
            const parsed = parseKey(it.storageKey);
            if (!parsed || parsed.kind !== "upload" || parsed.gymId !== gymId) {
              throw new Error(
                "storageKey must be under private/uploads/... and match gymId"
              );
            }
            const head = await this.s3
              .send(new HeadObjectCommand({ Bucket: BUCKET, Key: it.storageKey }))
              .catch((err) => {
                if (err?.$metadata?.httpStatusCode === 404)
                  throw new Error(
                    "Uploaded object not found. Did the PUT succeed?"
                  );
                throw err;
              });
            const contentType = head.ContentType || "";
            const size = Number(head.ContentLength ?? 0);
            if (!allowedContentType(contentType))
              throw new Error(`Unsupported contentType: ${contentType}`);
            if (!(size > 0 && Number.isFinite(size)))
              throw new Error("Object size invalid or zero");

            const approvedKey = `private/gym/${join.id}/approved/${parsed.uuid}.${
              parsed.ext
            }`;
            await copyObjectIfMissing(it.storageKey, approvedKey);
            return {
              approvedKey,
              objectUuid: parsed.uuid,
              uploadKey: it.storageKey,
              sha256: it.sha256,
            } as ReadyItem;
          } catch (e) {
            console.error("finalize copy failed", e);
            return null;
          }
        })
      );
      for (const r of results) if (r) ready.push(r);
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const images: Array<{
          id: string;
          gymId: number;
          equipmentId: number;
          status: GymImageStatus;
          storageKey: string | null;
        }> = [];
        let queued = 0;
        for (const r of ready) {
          const existing = await tx.gymEquipmentImage.findFirst({
            where: {
              gymId,
              equipmentId,
              OR: [
                ...(r.sha256 ? [{ sha256: r.sha256 }] : []),
                { objectUuid: r.objectUuid },
              ],
            },
            select: {
              id: true,
              gymId: true,
              equipmentId: true,
              status: true,
              storageKey: true,
            },
          });
          if (existing) {
            images.push(existing);
            continue;
          }
          const image = (await tx.gymEquipmentImage.create({
            data: {
              gymId,
              equipmentId,
              gymEquipmentId: join.id,
              storageKey: r.approvedKey,
              status: "PENDING",
              objectUuid: r.objectUuid,
              sha256: r.sha256 ?? null,
              capturedByUserId: userId ?? null,
              capturedAt: now,
              sourceId: tax.sourceId,
              splitId: tax.splitId,
              angleId: tax.angleId,
              heightId: tax.heightId,
              distanceId: tax.distanceId,
              lightingId: tax.lightingId,
              mirrorId: tax.mirrorId,
              isSafe: false,
            },
            select: {
              id: true,
              gymId: true,
              equipmentId: true,
              status: true,
              storageKey: true,
            },
          })) as {
            id: string;
            gymId: number;
            equipmentId: number;
            status: GymImageStatus;
            storageKey: string | null;
          };
          await tx.imageQueue.create({
            data: {
              jobType: "HASH",
              status: ImageJobStatus.pending,
              priority,
              storageKey: r.approvedKey,
            },
          });
          queued++;
          images.push(image);
        }
        return { images, queuedJobs: queued };
      },
      { timeout: 15000, maxWait: 5000 }
    );

    // Delete originals after DB commit
    for (let i = 0; i < ready.length; i += CONCURRENCY) {
      const batch = ready.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map((r) => deleteObjectIgnoreMissing(r.uploadKey).catch(() => {}))
      );
    }

    setImmediate(() => {
      kickBurstRunner().catch((e) => console.error("burst runner error", e));
    });

    return result;
  }

  async finalizeGymImages(input: FinalizeGymImagesDto, userId: number | null) {
    return this.finalizeGymImagesCore(input, userId, "recognition_user");
  }

  private async finalizeGymImagesCore(
    input: FinalizeGymImagesDto,
    userId: number | null,
    source: "recognition_user" | "gym_manager" | "admin" | "backfill"
  ) {
    const defaults = await this.getDefaultTaxonomyIds();
    const d = input.defaults;
    const join = await this.prisma.gymEquipment.upsert({
      where: {
        gymId_equipmentId: { gymId: d.gymId, equipmentId: d.equipmentId },
      },
      update: {},
      create: { gymId: d.gymId, equipmentId: d.equipmentId },
    });

    const images: any[] = [];
    let queued = 0;
    const priority = priorityFromSource(source);
    for (const it of input.items) {
      const parsed = parseKey(it.storageKey);
      if (!parsed || parsed.kind !== "upload" || parsed.gymId !== d.gymId) {
        throw new Error(
          "storageKey must be under private/uploads/... and match gymId"
        );
      }
      const objectUuid = parsed.uuid;
      const existing = await this.prisma.gymEquipmentImage.findFirst({
        where: {
          gymId: d.gymId,
          equipmentId: d.equipmentId,
          OR: [
            ...(it.sha256 ? [{ sha256: it.sha256 }] : []),
            { objectUuid },
          ],
        },
      });
      if (existing) {
        images.push(existing);
        continue;
      }
      const head = await this.s3
        .send(new HeadObjectCommand({ Bucket: BUCKET, Key: it.storageKey }))
        .catch((err) => {
          if (err?.$metadata?.httpStatusCode === 404)
            throw new Error("Uploaded object not found. Did the PUT succeed?");
          throw err;
        });
      const contentType = head.ContentType || "";
      const size = Number(head.ContentLength ?? 0);
      if (!allowedContentType(contentType))
        throw new Error(`Unsupported contentType: ${contentType}`);
      if (!(size > 0 && Number.isFinite(size)))
        throw new Error("Object size invalid or zero");

      const approvedKey = `private/gym/${join.id}/approved/${randomUUID()}.${
        parsed.ext
      }`;
      await copyObjectIfMissing(it.storageKey, approvedKey);
      await deleteObjectIgnoreMissing(it.storageKey);

      const image = await this.prisma.gymEquipmentImage.create({
        data: {
          gymId: d.gymId,
          equipmentId: d.equipmentId,
          gymEquipmentId: join.id,
          storageKey: approvedKey,
          objectUuid,
          sha256: it.sha256 ?? null,
          capturedByUserId: userId ?? null,
          capturedAt: new Date(),
          sourceId: it.sourceId ?? d.sourceId ?? defaults.sourceId,
          splitId: it.splitId ?? d.splitId ?? defaults.splitId,
          angleId: it.angleId ?? defaults.angleId,
          heightId: it.heightId ?? defaults.heightId,
          distanceId: it.distanceId ?? defaults.distanceId,
          lightingId: it.lightingId ?? d.lightingId ?? defaults.lightingId,
          mirrorId: it.mirrorId ?? defaults.mirrorId,
          status: "PENDING",
          isSafe: false,
        },
      });

      const jobs: Prisma.ImageQueueCreateManyInput[] = it.sha256
        ? []
        : [
            {
              jobType: "HASH",
              status: ImageJobStatus.pending,
              priority,
              storageKey: approvedKey,
            },
          ];
      if (jobs.length) {
        await this.prisma.imageQueue.createMany({ data: jobs });
        queued += jobs.length;
      }
      images.push(image);
    }
    if (queued > 0) {
      setImmediate(() => {
        kickBurstRunner().catch((e) => console.error("burst runner error", e));
      });
    }
    return { images, queuedJobs: queued };
  }

  async applyTaxonomiesToGymImages(input: ApplyTaxonomiesDto) {
    // Use the unchecked variant so we can update taxonomy foreign keys in bulk
    // via their scalar IDs. The regular UpdateMany type omits relation columns.
    const data: Prisma.GymEquipmentImageUncheckedUpdateManyInput = {};
    if (input.angleId !== undefined) data.angleId = input.angleId;
    if (input.heightId !== undefined) data.heightId = input.heightId;
    if (input.distanceId !== undefined) data.distanceId = input.distanceId;
    if (input.lightingId !== undefined) data.lightingId = input.lightingId;
    if (input.mirrorId !== undefined) data.mirrorId = input.mirrorId;
    if (input.splitId !== undefined) data.splitId = input.splitId;
    if (input.sourceId !== undefined) data.sourceId = input.sourceId;

    const out = await this.prisma.gymEquipmentImage.updateMany({
      where: { id: { in: input.imageIds } },
      data,
    });
    return { updatedCount: out.count };
  }
}
