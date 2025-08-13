import { ImageIntakeService } from "../../../src/modules/images/image-intake.service";
import { PrismaClient } from "../../../src/lib/prisma";
import { S3Client } from "@aws-sdk/client-s3";

// Mock the S3 client's send method so no real network calls are made during tests
const sendMock = jest
  .spyOn(S3Client.prototype, "send")
  .mockResolvedValue({ ContentType: "image/jpeg", ContentLength: 12345 } as any);

const prisma = {
  gymEquipmentImage: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockResolvedValue({
        id: "cuid1",
        gymId: 1,
        equipmentId: 2,
        storageKey: "private/uploads/1/2025/01/u.jpg",
        status: "PENDING",
      }),
  },
} as unknown as PrismaClient;

describe("finalizeGymImage", () => {
  it("creates DB row after successful HEAD", async () => {
    const svc = new ImageIntakeService(prisma);
    const out = await svc.finalizeGymImage({
      storageKey:
        "private/uploads/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      gymId: 1,
      equipmentId: 2,
    } as any);
    expect(out.image.id).toBe("cuid1");
    expect(prisma.gymEquipmentImage.create).toHaveBeenCalled();
  });

  it("rejects mismatched gymId ↔ storageKey", async () => {
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
});