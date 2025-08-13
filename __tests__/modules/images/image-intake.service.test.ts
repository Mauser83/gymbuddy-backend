import { ImageIntakeService } from "../../../src/modules/images/image-intake.service";
import { PrismaClient } from "../../../src/lib/prisma";
import * as AWS from "@aws-sdk/client-s3";

jest.spyOn(AWS, "S3Client").mockImplementation(() => ({} as any));
jest.spyOn(AWS, "HeadObjectCommand").mockImplementation((x: any) => x as any);

const sendMock = jest
  .fn()
  .mockResolvedValue({ ContentType: "image/jpeg", ContentLength: 12345 });
(AWS as any).__proto__.send = sendMock;

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
        storageKey: "private/uploads/99/2025/01/uuid.jpg",
        gymId: 1,
        equipmentId: 2,
      } as any)
    ).rejects.toThrow(/does not match/i);
  });
});