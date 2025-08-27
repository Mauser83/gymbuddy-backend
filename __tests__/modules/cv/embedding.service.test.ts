import { randomUUID } from "crypto";
import { cleanDB, prisma } from "../../testUtils";
import { getLatestEmbeddedImageService } from "../../../src/modules/cv/embedding.service";

const DIM = 512;
function padVec(seed: number[]) {
  return Array.from({ length: DIM }, (_, i) => seed[i] ?? 0);
}

describe("getLatestEmbeddedImageService", () => {
  let gymId: number;
  let latestImageId: string;

  beforeAll(async () => {
    await cleanDB();

    const cat = await prisma.equipmentCategory.create({
      data: { name: `cat-${randomUUID()}`, slug: `cat-${randomUUID()}` },
    });
    const sub = await prisma.equipmentSubcategory.create({
      data: { name: `sub-${randomUUID()}`, slug: `sub-${randomUUID()}`, categoryId: cat.id },
    });
    const eq = await prisma.equipment.create({
      data: {
        name: `eq-${randomUUID()}`,
        brand: "brand",
        categoryId: cat.id,
        subcategoryId: sub.id,
      },
    });

    const gym = await prisma.gym.create({
      data: {
        name: "gym",
        country: "US",
        city: "city",
        address: "addr",
      },
    });
    gymId = gym.id;
    const gymEq = await prisma.gymEquipment.create({
      data: { gymId: gym.id, equipmentId: eq.id, quantity: 1 },
    });

    async function createGymImage(capturedAt: Date) {
      const imageId = randomUUID();
      await prisma.equipmentImage.create({
        data: {
          id: imageId,
          equipmentId: eq.id,
          storageKey: randomUUID(),
          mimeType: "image/jpeg",
          width: 1,
          height: 1,
          sha256: randomUUID(),
        },
      });
      const vec = `[${padVec([1]).join(",")}]`;
      const gymImageId = randomUUID();
      await prisma.$executeRaw`INSERT INTO "GymEquipmentImage" ("id","gymId","equipmentId","gymEquipmentId","imageId","storageKey","sha256","embedding","capturedAt") VALUES (${gymImageId}, ${gym.id}, ${eq.id}, ${gymEq.id}, ${imageId}, ${randomUUID()}, ${randomUUID()}, ${vec}::vector, ${capturedAt})`;
      return gymImageId;
    }

    await createGymImage(new Date("2024-01-01T00:00:00Z"));
    latestImageId = await createGymImage(new Date("2024-02-01T00:00:00Z"));
  });

  it("returns latest gym image by capturedAt", async () => {
    const result = await getLatestEmbeddedImageService({ scope: "GYM", gymId });
    expect(result).toBeTruthy();
    expect(result!.imageId).toBe(latestImageId);
    expect(new Date(result!.createdAt).toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(result!.scope).toBe("GYM");
  });
});