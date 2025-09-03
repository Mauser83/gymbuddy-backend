import type { PrismaClient } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma";
import { ImageJobStatus } from "../../generated/prisma";
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

    // 2) HEAD the object
    const head = await this.s3
      .send(
        new HeadObjectCommand({
          Bucket: BUCKET,
          Key: input.storageKey,
        })
      )
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

    // 3) Dedup by sha256 if provided
    if (input.sha256) {
      const existing = await this.prisma.gymEquipmentImage.findFirst({
        where: { sha256: input.sha256 },
        select: { id: true },
      });
      if (existing) throw new Error("Duplicate image (sha256 already exists)");
    }

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

    // 5) Create GymEquipmentImage
    let image = await this.prisma.gymEquipmentImage.create({
      data: {
        gymEquipmentId: join.id,
        gymId: input.gymId,
        equipmentId: input.equipmentId,
        status: "PENDING",
        storageKey: input.storageKey,
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

    const approvedKey = `private/gym/${join.id}/approved/${randomUUID()}.${
      parsed.ext
    }`;
    await copyObjectIfMissing(input.storageKey, approvedKey);
    await deleteObjectIgnoreMissing(input.storageKey);
    image = await this.prisma.gymEquipmentImage.update({
      where: { id: image.id },
      data: { storageKey: approvedKey },
    });

    // 6) Enqueue HASH, SAFETY, EMBED for gym upload (by approvedKey)
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
            imageId: image.id,
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
    userId: number | null,
  ) {
    return this.finalizeGymImagesCore(input, userId, "admin");
  }

  async finalizeGymImages(input: FinalizeGymImagesDto, userId: number | null) {
    return this.finalizeGymImagesCore(input, userId, "recognition_user");
  }

  private async finalizeGymImagesCore(
    input: FinalizeGymImagesDto,
    userId: number | null,
    source: "recognition_user" | "gym_manager" | "admin" | "backfill",
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
          "storageKey must be under private/uploads/... and match gymId",
        );
      }
      const objectUuid = parsed.uuid;
      let image = await this.prisma.gymEquipmentImage.create({
        data: {
          gymId: d.gymId,
          equipmentId: d.equipmentId,
          gymEquipmentId: join.id,
          storageKey: it.storageKey,
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

      const approvedKey = `private/gym/${join.id}/approved/${randomUUID()}.${
        parsed.ext
      }`;
      await copyObjectIfMissing(it.storageKey, approvedKey);
      await deleteObjectIgnoreMissing(it.storageKey);
      image = await this.prisma.gymEquipmentImage.update({
        where: { id: image.id },
        data: { storageKey: approvedKey },
      });

      const jobs: Prisma.ImageQueueCreateManyInput[] = it.sha256
        ? []
        : [
            {
              jobType: "HASH",
              status: ImageJobStatus.pending,
              priority,
              storageKey: approvedKey,
              imageId: image.id,
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
                kickBurstRunner().catch((e) =>
          console.error("burst runner error", e),
              );
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
