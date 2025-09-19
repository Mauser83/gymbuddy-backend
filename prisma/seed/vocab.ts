/// <reference types="node" />
import { PrismaClient } from '../../src/generated/prisma';
const prisma = new PrismaClient();

type Row = {
  key: string;
  label: string;
  description?: string;
  displayOrder?: number;
  active?: boolean;
};

async function upsertAll<T extends { key: string }>(model: any, rows: T[]) {
  for (const [i, r] of rows.entries()) {
    await model.upsert({
      where: { key: r.key },
      update: { ...r, displayOrder: i, active: true },
      create: { ...r, displayOrder: i, active: true },
    });
  }
}

async function main() {
  await upsertAll(prisma.splitType, [
    { key: 'GOLDEN', label: 'Golden' },
    { key: 'TRAINING', label: 'Training' },
    { key: 'VAL', label: 'Validation' },
  ]);

  await upsertAll(prisma.sourceType, [
    { key: 'ADMIN_CAPTURE', label: 'Admin Capture' },
    { key: 'PROMOTED_FROM_GYM', label: 'Promoted from Gym' },
    { key: 'IMPORT', label: 'Import' },
  ]);

  await upsertAll(prisma.angleType, [
    { key: 'PRIMARY', label: 'Primary' },
    { key: 'SIDE', label: 'Side' },
    { key: 'REAR', label: 'Rear' },
    { key: 'DETAIL', label: 'Detail' },
    { key: 'OTHER', label: 'Other' },
  ]);

  await upsertAll(prisma.heightType, [
    { key: 'EYE', label: 'Eye' },
    { key: 'CHEST', label: 'Chest' },
    { key: 'WAIST', label: 'Waist' },
    { key: 'FLOOR', label: 'Floor' },
  ]);

  await upsertAll(prisma.lightingType, [
    { key: 'NATURAL', label: 'Natural' },
    { key: 'ARTIFICIAL', label: 'Artificial' },
    { key: 'MIXED', label: 'Mixed' },
    { key: 'LOW', label: 'Low' },
    { key: 'HIGH', label: 'High' },
  ]);

  await upsertAll(prisma.mirrorType, [
    { key: 'NONE', label: 'None' },
    { key: 'MIRROR_PRESENT', label: 'Mirror Present' },
  ]);

  await upsertAll(prisma.distanceType, [
    { key: 'CLOSE', label: 'Close' },
    { key: 'MEDIUM', label: 'Medium' },
    { key: 'FAR', label: 'Far' },
  ]);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
