import type { AuthContext } from "../auth/auth.types";
import { TaxonomyService } from "./taxonomy.service";
import { GraphQLError } from "graphql";
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
      console.log("createTaxonomyType args:", args)
      const dto = Object.assign(new CreateTaxonomyDto(), args.input, {
        kind: args.kind,
      });
      await validateInput(dto, CreateTaxonomyDto);
      const service = new TaxonomyService(context.prisma);
      try {
        const row = await service.create(args.kind, args.input);
        if (
          row == null ||
          row.id == null ||
          row.key == null ||
          row.label == null ||
          row.active == null ||
          row.displayOrder == null ||
          row.kind == null
        ) {
          throw new Error("Service returned incomplete taxonomy row");
        }
        return row;
      } catch (e: any) {
        console.error(e);
        if (e.code === "P2002" || /unique/i.test(e.message)) {
          throw new GraphQLError("Key already exists for this taxonomy kind", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        throw e;
      }
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