import { randomUUID } from "crypto";
import { executeOperation, prisma, cleanDB } from "../../testUtils";

const QUERY = `
  query($input: KnnSearchInput!) {
    knnSearch(input: $input) {
      imageId
      equipmentId
      score
      storageKey
    }
  }
`;

let globalImg1: any;
let globalImg2: any;
let gymImg1: any;
let gymImg2: any;

const DIM = 512;
function padVec(seed: number[]) {
  return Array.from({ length: DIM }, (_, i) => seed[i] ?? 0);
}

beforeAll(async () => {
  await cleanDB();

  const catName = `cat-${randomUUID()}`;
  const category = await prisma.equipmentCategory.create({
    data: { name: catName, slug: catName },
  });
  const subName = `sub-${randomUUID()}`;
  const sub = await prisma.equipmentSubcategory.create({
    data: { name: subName, slug: subName, categoryId: category.id },
  });
  const eq = await prisma.equipment.create({
    data: {
      name: `eq-${randomUUID()}`,
      brand: "brand",
      categoryId: category.id,
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
  const gymEq = await prisma.gymEquipment.create({
    data: { gymId: gym.id, equipmentId: eq.id, quantity: 1 },
  });

  async function createImage(storageKey: string, sha: string, isGym = false) {
    const imageId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "EquipmentImage" ("id","equipmentId","storageKey","mimeType","width","height","sha256")
      VALUES (${imageId}, ${eq.id}, ${storageKey}, 'image/jpeg', 0, 0, ${sha})
    `;
    if (isGym) {
      const gymImageId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "GymEquipmentImage" ("id","gymId","equipmentId","gymEquipmentId","imageId","storageKey","sha256")
        VALUES (${gymImageId}, ${gym.id}, ${eq.id}, ${gymEq.id}, ${imageId}, ${storageKey}, ${sha})
      `;
      return { id: imageId, gymImageId, gymId: gym.id };
    }
    return { id: imageId };
  }

  globalImg1 = await createImage("g1", "sha1");
  globalImg2 = await createImage("g2", "sha2");
  gymImg1 = await createImage("gy1", "sha3", true);
  gymImg2 = await createImage("gy2", "sha4", true);

  // extra global images for limit/latency tests
  const extras: any[] = [];
  for (let i = 0; i < 100; i++) {
    extras.push(await createImage(`e${i}`, `ex${i}`));
  }

  async function insertEmbedding(img: any, scope: string, vec: number[]) {
    const padded = padVec(vec);
    const vectorParam = `[${padded.join(",")}]`;
    if (scope === "GLOBAL") {
      await prisma.$executeRaw`
        INSERT INTO "ImageEmbedding" ("id","imageId","scope","scope_type","modelVendor","modelName","modelVersion","dim","embeddingVec")
        VALUES (${randomUUID()}, ${
        img.id
      }, ${scope}, 'GLOBAL', 'local','mobileCLIP-S0','1.0', ${DIM}, ${vectorParam}::vector)
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ImageEmbedding" ("id","gymImageId","scope","scope_type","gym_id","modelVendor","modelName","modelVersion","dim","embeddingVec")
        VALUES (${randomUUID()}, ${img.gymImageId}, ${scope}, 'GYM', ${
        img.gymId
      }, 'local','mobileCLIP-S0','1.0', ${DIM}, ${vectorParam}::vector)
      `;
    }
  }

  await insertEmbedding(globalImg1, "GLOBAL", [1, 0, 0]);
  await insertEmbedding(globalImg2, "GLOBAL", [0.8, 0.1, 0]);
  for (const img of extras) {
    await insertEmbedding(img, "GLOBAL", [
      Math.random() * 0.1,
      Math.random(),
      Math.random(),
    ]);
  }
  await insertEmbedding(gymImg1, "GYM", [0.1, 0.2, 0]);
  await insertEmbedding(gymImg2, "GYM", [0.01, 0.2, 0]);
});

describe("knnSearch", () => {
  it("returns deterministic results", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: { vector: padVec([1, 0, 0]), scope: "GLOBAL", limit: 5 },
      },
    });
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits[0].imageId).toBe(globalImg1.id);
    expect(hits[1].imageId).toBe(globalImg2.id);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("filters by scope", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: { imageId: gymImg1.gymImageId, scope: "GYM", limit: 10 },
      },
    });
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits.map((h: any) => h.imageId)).toEqual([
      gymImg1.gymImageId,
      gymImg2.gymImageId,
    ]);
  });

  it("guards vector dimension", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: { input: { vector: [1, 0], scope: "GLOBAL" } },
    });
    const err = (res.body as any).singleResult.errors?.[0].message;
    expect(err).toMatch(/dimension/i);
  });

  it("clamps limit", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: { vector: padVec([1, 0, 0]), scope: "GLOBAL", limit: 100 },
      },
    });
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits).toHaveLength(50);
  });

  it("meets latency budget", async () => {
    const start = Date.now();
    await executeOperation({
      query: QUERY,
      variables: {
        input: { vector: padVec([1, 0, 0]), scope: "GLOBAL", limit: 10 },
      },
    });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
