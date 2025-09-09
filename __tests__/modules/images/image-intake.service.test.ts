jest.mock("../../../src/modules/images/image-worker", () => ({
  // Provide a Promise to avoid errors when tests call .catch on the result
  kickBurstRunner: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../../src/generated/prisma", () => ({
  ImageJobStatus: { pending: "PENDING" },
}));

import { ImageIntakeService } from "../../../src/modules/images/image-intake.service";
import type { PrismaClient } from "../../../src/lib/prisma";
import { S3Client } from "@aws-sdk/client-s3";

// Mock the S3 client's send method so no real network calls are made during tests
jest
  .spyOn(S3Client.prototype, "send")
  .mockResolvedValue({ ContentType: "image/jpeg", ContentLength: 12345 } as any);

function createPrismaMock() {
  const image = {
    id: "cuid1",
    gymId: 1,
    equipmentId: 2,
    storageKey: "private/uploads/1/2025/01/u.jpg",
    status: "PENDING",
  };

  return {
    gymEquipment: {
      upsert: jest.fn().mockResolvedValue({ id: 1 }),
    },
    gymEquipmentImage: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(image),
      update: jest.fn().mockImplementation(({ data }) => ({ ...image, ...data })),
    },
    imageQueue: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient;
}

describe("finalizeGymImage", () => {
  it("creates DB row and enqueues jobs", async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const out = await svc.finalizeGymImage({
      storageKey:
        "private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      gymId: 1,
      equipmentId: 2,
    } as any);
    expect(out.image.id).toBe("cuid1");
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalled();
    expect(prisma.imageQueue.createMany).toHaveBeenCalled();
    expect(out.queuedJobs).toEqual(["HASH"]);
  });

  it("omits HASH when sha256 provided", async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const out = await svc.finalizeGymImage({
      storageKey:
        "private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      gymId: 1,
      equipmentId: 2,
      sha256: "deadbeef",
    } as any);
    expect(out.queuedJobs).toEqual([]);
    expect(prisma.imageQueue.createMany).not.toHaveBeenCalled();
  });

  it("rejects mismatched gymId ↔ storageKey", async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    await expect(
      svc.finalizeGymImage({
        storageKey:
          "private/uploads/99/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
        gymId: 1,
        equipmentId: 2,
      } as any)
    ).rejects.toThrow(/does not match/i);
  });

  it("is idempotent on repeated finalize", async () => {
    const prisma = createPrismaMock();
    const svc = new ImageIntakeService(prisma);
    const input = {
      storageKey:
        "private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      gymId: 1,
      equipmentId: 2,
      sha256: "deadbeef",
    } as any;
    await svc.finalizeGymImage(input);
    const existing = {
      id: "cuid1",
      gymId: 1,
      equipmentId: 2,
      storageKey: "approved/key.jpg",
      status: "PENDING",
    };
    (prisma.gymEquipmentImage.findFirst as any).mockResolvedValue(existing);
    const out = await svc.finalizeGymImage(input);
    expect(out.image.id).toBe("cuid1");
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalledTimes(1);
  });
});

describe("finalizeGymImagesAdmin", () => {
  function createAdminPrismaMock() {
    const prisma: any = {
      gymEquipment: { upsert: jest.fn().mockResolvedValue({ id: 1 }) },
      gymEquipmentImage: {
        create: jest.fn().mockImplementation(({ data, select }) => {
          const image = { id: "cuid1", ...data };
          if (select) {
            const out: any = {};
            for (const k of Object.keys(select)) if ((select as any)[k]) out[k] = (image as any)[k];
            return out;
          }
          return image;
        }),
      },
      imageQueue: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    return prisma as unknown as PrismaClient;
  }

  it("returns storageKey for each finalized image", async () => {
    const prisma = createAdminPrismaMock();
    const svc = new ImageIntakeService(prisma);
    (svc as any).getDefaultTaxonomyIds = jest.fn().mockResolvedValue({
      sourceId: 1,
      splitId: 1,
      angleId: 1,
      heightId: 1,
      distanceId: 1,
      lightingId: 1,
      mirrorId: 1,
    });
    const out = await svc.finalizeGymImagesAdmin(
      {
        defaults: { gymId: 1, equipmentId: 2 },
        items: [
          {
            storageKey:
              "private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
          },
        ],
      },
      null
    );
    expect(out.images[0].storageKey).toBeDefined();
  });
});