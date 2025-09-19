import { CreateTaxonomyInputDto } from './taxonomy.dto';
import { TaxonomyKind } from './taxonomy.types';
import { PrismaClient, Prisma } from '../../lib/prisma';

export class TaxonomyService {
  constructor(private readonly prisma: PrismaClient) {}

  private delegate(kind: TaxonomyKind): { d: any; kind: TaxonomyKind } {
    switch (kind) {
      case 'ANGLE':
        return { d: this.prisma.angleType, kind };
      case 'HEIGHT':
        return { d: this.prisma.heightType, kind };
      case 'LIGHTING':
        return { d: this.prisma.lightingType, kind };
      case 'MIRROR':
        return { d: this.prisma.mirrorType, kind };
      case 'DISTANCE':
        return { d: this.prisma.distanceType, kind };
      case 'SOURCE':
        return { d: this.prisma.sourceType, kind };
      case 'SPLIT':
        return { d: this.prisma.splitType, kind };
    }
  }

  async list(kind: TaxonomyKind, active?: boolean) {
    const { d } = this.delegate(kind)!;
    const rows = await d.findMany({
      where: active === undefined ? {} : { active },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r: any) => ({ ...r, kind }));
  }

  async get(kind: TaxonomyKind, id: number) {
    const { d } = this.delegate(kind)!;
    const row = await d.findUnique({ where: { id } });
    return row ? { ...row, kind } : null;
  }

  private async nextDisplayOrder(kind: TaxonomyKind) {
    const { d } = this.delegate(kind)!;
    const last = await d.findFirst({
      select: { displayOrder: true },
      orderBy: { displayOrder: 'desc' },
    });
    return (last?.displayOrder ?? 0) + 1;
  }

  async create(kind: TaxonomyKind, input: CreateTaxonomyInputDto) {
    const { d } = this.delegate(kind)!;
    const displayOrder = input.displayOrder ?? (await this.nextDisplayOrder(kind));
    try {
      const row = await d.create({
        data: {
          key: input.key,
          label: input.label.trim(),
          description: input.description,
          active: input.active ?? true,
          displayOrder,
        },
      });
      return { ...row, kind };
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('Key already exists');
      }
      throw e;
    }
  }

  async update(
    kind: TaxonomyKind,
    id: number,
    input: Partial<{
      key: string;
      label: string;
      description?: string;
      active?: boolean;
      displayOrder?: number;
    }>,
  ) {
    const { d } = this.delegate(kind)!;
    try {
      const row = await d.update({ where: { id }, data: { ...input } });
      return { ...row, kind };
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('Key already exists');
      }
      throw e;
    }
  }

  async setActive(kind: TaxonomyKind, id: number, active: boolean) {
    const { d } = this.delegate(kind)!;
    const row = await d.update({ where: { id }, data: { active } });
    return { ...row, kind };
  }

  async delete(kind: TaxonomyKind, id: number) {
    await this.delegate(kind)!.d.delete({ where: { id } });
    return true;
  }

  async reorder(kind: TaxonomyKind, items: { id: number; displayOrder: number }[]) {
    const { d } = this.delegate(kind)!;
    const tx = items.map((it) =>
      d.update({ where: { id: it.id }, data: { displayOrder: it.displayOrder } }),
    );
    await this.prisma.$transaction(tx);
    return this.list(kind, undefined);
  }
}
