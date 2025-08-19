import type { PrismaClient } from "../../lib/prisma";
import type { Prisma } from "../../generated/prisma";
import { ImageJobStatus } from "../../generated/prisma";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { parseKey } from "../../utils/makeKey";
import {
  FinalizeGymImageDto,
  FinalizeGymImagesDto,
  ApplyTaxonomiesDto,
} from "../images/images.dto";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

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

  async finalizeGymImage(input: FinalizeGymImageDto) {
    // 1) Validate key & gymId
    const parsed = parseKey(input.storageKey);
    if (!parsed || parsed.kind !== "upload") throw new Error("storageKey must be under private/uploads/...");
    if (parsed.gymId !== input.gymId) throw new Error("storageKey gymId does not match input.gymId");

    // 2) HEAD the object
    const head = await this.s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: input.storageKey,
    })).catch((err) => {
      if (err?.$metadata?.httpStatusCode === 404) throw new Error("Uploaded object not found. Did the PUT succeed?");
      throw err;
    });

    const contentType = head.ContentType || "";
    const size = Number(head.ContentLength ?? 0);
    if (!allowedContentType(contentType)) throw new Error(`Unsupported contentType: ${contentType}`);
    if (!(size > 0 && Number.isFinite(size))) throw new Error("Object size invalid or zero");

    // 3) Dedup by sha256 if provided
    if (input.sha256) {
      const existing = await this.prisma.gymEquipmentImage.findFirst({
        where: { sha256: input.sha256 },
        select: { id: true },
      });
      if (existing) throw new Error("Duplicate image (sha256 already exists)");
    }

    // 4) Create GymEquipmentImage
    const image = await this.prisma.gymEquipmentImage.create({
      data: {
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
      },
    });

    // 5) Enqueue HASH, SAFETY, EMBED for gym upload (by storageKey)
    const jobs: Prisma.ImageQueueCreateManyInput[] = [
      // If sha256 was already provided, you can skip HASH:
      ...(input.sha256
        ? []
        : [{ jobType: "HASH", status: ImageJobStatus.pending, priority: 0, storageKey: input.storageKey }]),
      { jobType: "SAFETY", status: ImageJobStatus.pending, priority: 0, storageKey: input.storageKey },
      { jobType: "EMBED", status: ImageJobStatus.pending, priority: 0, storageKey: input.storageKey },
    ];
    await this.prisma.imageQueue.createMany({ data: jobs });

    return { image, queuedJobs: jobs.map(j => j.jobType) };
  }

  async finalizeGymImages(input: FinalizeGymImagesDto) {
    const images = [] as any[];
    let queued = 0;
    for (const item of input.items) {
      const dto: FinalizeGymImageDto = {
        storageKey: item.storageKey,
        gymId: input.defaults.gymId,
        equipmentId: input.defaults.equipmentId,
        sha256: item.sha256,
        angleId: item.angleId,
        heightId: item.heightId,
        distanceId: item.distanceId,
        mirrorId: item.mirrorId,
        lightingId: item.lightingId ?? input.defaults.lightingId,
        splitId: item.splitId ?? input.defaults.splitId,
        sourceId: item.sourceId ?? input.defaults.sourceId,
      } as FinalizeGymImageDto;
      const res = await this.finalizeGymImage(dto);
      images.push(res.image);
      queued += res.queuedJobs.length;
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