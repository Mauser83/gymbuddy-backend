import { randomUUID } from "crypto";
import { executeOperation, prisma, cleanDB } from "../../testUtils";

const QUERY = `
  query($input: KnnSearchInput!) {
    knnSearch(input: $input) {
      imageId
      equipmentId
      score
    }
  }
`;

let globalImg1: any;
let globalImg2: any;
let gymImg1: any;
let gymImg2: any;
let gym: any;

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

  gym = await prisma.gym.create({
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

  async function createImage(
    storageKey: string,
    sha: string,
    vec: number[],
    isGym = false
  ) {
    const padded = padVec(vec);
    const vectorParam = `[${padded.join(",")}]`;
    const imageId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "EquipmentImage" ("id","equipmentId","storageKey","mimeType","width","height","sha256","embedding")
      VALUES (${imageId}, ${eq.id}, ${storageKey}, 'image/jpeg', 0, 0, ${sha}, ${vectorParam}::vector)
    `;
    if (isGym) {
      const gymImageId = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "GymEquipmentImage" ("id","gymId","equipmentId","gymEquipmentId","imageId","storageKey","sha256","embedding")
        VALUES (${gymImageId}, ${gym.id}, ${eq.id}, ${gymEq.id}, ${imageId}, ${storageKey}, ${sha}, ${vectorParam}::vector)
      `;
      return { id: gymImageId };
    }
    return { id: imageId };
  }

  globalImg1 = await createImage("g1", "sha1", [1, 0, 0]);
  globalImg2 = await createImage("g2", "sha2", [0.8, 0.1, 0]);
  gymImg1 = await createImage("gy1", "sha3", [0.1, 0.2, 0], true);
  gymImg2 = await createImage("gy2", "sha4", [0.01, 0.2, 0], true);

  const extras: any[] = [];
  for (let i = 0; i < 100; i++) {
    extras.push(
      await createImage(`e${i}`, `ex${i}`, [
        Math.random() * 0.1,
        Math.random(),
        Math.random(),
      ])
    );
  }
});

describe("knnSearch", () => {
  it("returns deterministic results", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: {
          imageId: globalImg1.id,
          scope: "GLOBAL",
          gymId: gym.id,
          limit: 5,
        },
      },
    });
    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeUndefined();
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits[0].imageId).toBe(globalImg2.id);
  });

  it("filters by scope", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: {
          imageId: gymImg1.id,
          scope: "GYM",
          gymId: gym.id,
          limit: 10,
        },
      },
    });
    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeUndefined();
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits.map((h: any) => h.imageId)).toEqual([gymImg2.id]);
  });

  it("requires gymId for GYM scope", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: { imageId: gymImg1.id, scope: "GYM", limit: 5 },
      },
    });
    const err = (res.body as any).singleResult.errors?.[0].message;
    expect(err).toMatch(/gymId/);
  });

  it("clamps limit", async () => {
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: {
          imageId: globalImg1.id,
          scope: "GLOBAL",
          gymId: gym.id,
          limit: 1000,
        },
      },
    });
    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeUndefined();
    const hits = (res.body as any).singleResult.data.knnSearch;
    expect(hits).toHaveLength(100);
  });

  it("meets latency budget", async () => {
    const start = Date.now();
    const res = await executeOperation({
      query: QUERY,
      variables: {
        input: {
          imageId: globalImg1.id,
          scope: "GLOBAL",
          gymId: gym.id,
          limit: 10,
        },
      },
    });
    const errors = (res.body as any).singleResult.errors;
    expect(errors).toBeUndefined();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});