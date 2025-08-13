import { PrismaClient } from "../../lib/prisma";

export class TaxonomyService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  angleTypes(active = true) {
    return this.prisma.angleType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  heightTypes(active = true) {
    return this.prisma.heightType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  lightingTypes(active = true) {
    return this.prisma.lightingType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  mirrorTypes(active = true) {
    return this.prisma.mirrorType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  distanceTypes(active = true) {
    return this.prisma.distanceType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  sourceTypes(active = true) {
    return this.prisma.sourceType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }

  splitTypes(active = true) {
    return this.prisma.splitType.findMany({
      where: active ? { active: true } : {},
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
  }
}