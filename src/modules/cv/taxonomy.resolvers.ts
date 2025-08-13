import type { AuthContext } from "../auth/auth.types";
import { TaxonomyService } from "./taxonomy.service";
import {
  CreateTaxonomyInputDto,
  CreateTaxonomyDto,
  UpdateTaxonomyInputDto,
  UpdateTaxonomyDto,
  ReorderTaxonomyDto,
} from "./taxonomy.dto";
import { validateInput } from "../../middlewares/validation";
import { TaxonomyKind } from "./taxonomy.types";

export const TaxonomyResolvers = {
  Query: {
    taxonomyTypes: async (
      _: unknown,
      args: { kind: TaxonomyKind; active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.list(args.kind, args.active);
    },
    taxonomyType: async (
      _: unknown,
      args: { kind: TaxonomyKind; id: number },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.get(args.kind, args.id);
    },
  },
  Mutation: {
    createTaxonomyType: async (
      _: unknown,
      args: { kind: TaxonomyKind; input: CreateTaxonomyInputDto },
      context: AuthContext,
    ) => {
      const dto = Object.assign(new CreateTaxonomyDto(), args.input, {
        kind: args.kind,
      });
      await validateInput(dto, CreateTaxonomyDto);
      const service = new TaxonomyService(context.prisma);
      return service.create(args.kind, args.input);
    },
    updateTaxonomyType: async (
      _: unknown,
      args: { kind: TaxonomyKind; id: number; input: UpdateTaxonomyInputDto },
      context: AuthContext,
    ) => {
      const dto = Object.assign(new UpdateTaxonomyDto(), args.input, {
        kind: args.kind,
        id: args.id,
      });
      await validateInput(dto, UpdateTaxonomyDto);
      const service = new TaxonomyService(context.prisma);
      return service.update(args.kind, args.id, args.input);
    },
    setTaxonomyActive: async (
      _: unknown,
      args: { kind: TaxonomyKind; id: number; active: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.setActive(args.kind, args.id, args.active);
    },
    deleteTaxonomyType: async (
      _: unknown,
      args: { kind: TaxonomyKind; id: number },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.delete(args.kind, args.id);
    },
    reorderTaxonomyTypes: async (
      _: unknown,
      args: { kind: TaxonomyKind; items: ReorderTaxonomyDto["items"] },
      context: AuthContext,
    ) => {
      const dto = Object.assign(new ReorderTaxonomyDto(), {
        kind: args.kind,
        items: args.items,
      });
      await validateInput(dto, ReorderTaxonomyDto);
      const service = new TaxonomyService(context.prisma);
      return service.reorder(args.kind, args.items);
    },
  },
};