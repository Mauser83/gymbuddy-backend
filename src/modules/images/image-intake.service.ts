import { PrismaClient, Prisma } from "../../lib/prisma";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { parseKey } from "../../utils/makeKey";
import { FinalizeGymImageDto } from "../images/images.dto";

const BUCKET = process.env.R2_BUCKET!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
if (!BUCKET || !ACCOUNT_ID) throw new Error("R2_BUCKET/R2_ACCOUNT_ID must be set");

// feature flag: if your ImageQueue FK is EquipmentImage.id, keep this false and enqueue at promotion.
// If you changed your queue to accept GymEquipmentImage or storageKey, set true.
const ENQUEUE_ON_FINALIZE = false as const;

function allowedContentType(ct?: string) {
  return !!ct && /^(image\/jpeg|image\/png|image\/webp)$/i.test(ct);
}
function extFromContentType(ct: string) {
  if (/jpeg/i.test(ct)) return "jpg";
  if (/png/i.test(ct)) return "png";
  if (/webp/i.test(ct)) return "webp";
  return "jpg";
}

export class ImageIntakeService {
  private prisma: PrismaClient;
  private s3: S3Client;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async finalizeGymImage(input: FinalizeGymImageDto) {
    // 1) Validate storageKey shape & gymId consistency
    const parsed = parseKey(input.storageKey);
    if (!parsed || parsed.kind !== "upload") {
      throw new Error("storageKey must be under private/uploads/...");
    }
    if (parsed.gymId !== input.gymId) {
      throw new Error("storageKey gymId does not match input.gymId");
    }

    // 2) HEAD object to verify existence + get contentType/size
    const head = await this.s3
      .send(
        new HeadObjectCommand({
          Bucket: BUCKET,
          Key: input.storageKey,
        })
      )
      .catch((err) => {
        if (err?.$metadata?.httpStatusCode === 404) {
          throw new Error("Uploaded object not found. Did the PUT succeed?");
        }
        throw err;
      });

    const contentType = head.ContentType || "application/octet-stream";
    const contentLength = Number(head.ContentLength ?? 0);
    if (!allowedContentType(contentType)) {
      throw new Error(`Unsupported contentType: ${contentType}`);
    }
    if (contentLength <= 0 || !Number.isFinite(contentLength)) {
      throw new Error("Object size invalid or zero");
    }

    // Optional: validate key extension vs HEAD contentType
    const expectedExt = extFromContentType(contentType);
    if (parsed.ext !== expectedExt) {
      // Not fatal, but helps keep things tidy
      // throw new Error(`Key extension .${parsed.ext} mismatches content-type ${contentType}`);
    }

    // 3) If sha256 provided, avoid duplicates (unique index on sha256)
    if (input.sha256) {
      const existing = await this.prisma.gymEquipmentImage.findFirst({
        where: { image: { sha256: input.sha256 } },
        select: { id: true },
      });
      if (existing) {
        // Up to you: return the existing record or fail. We'll fail with a readable message.
        throw new Error("Duplicate image (sha256 already exists)");
      }
    }

    // 4) Create GymEquipmentImage row (PENDING)
    let created;
    try {
      created = await this.prisma.gymEquipmentImage.create({
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
        } as any,
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("Unique constraint violation (likely sha256)");
      }
      throw e;
    }

    // 5) Enqueue jobs (optional now; always required at promotion if not enqueued here)
    const queued: string[] = [];
    if (ENQUEUE_ON_FINALIZE) {
      queued.push("HASH", "SAFETY");
      if (input.sha256) {
        const idx = queued.indexOf("HASH");
        if (idx >= 0) queued.splice(idx, 1);
      }
    }

    return { image: created, queuedJobs: queued };
  }
}