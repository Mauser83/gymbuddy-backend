import type { AuthContext } from "../auth/auth.types";
import { TaxonomyService } from "./taxonomy.service";

export const TaxonomyResolvers = {
  Query: {
    angleTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.angleTypes(args.active ?? true);
    },
    heightTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.heightTypes(args.active ?? true);
    },
    lightingTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.lightingTypes(args.active ?? true);
    },
    mirrorTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.mirrorTypes(args.active ?? true);
    },
    distanceTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.distanceTypes(args.active ?? true);
    },
    sourceTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.sourceTypes(args.active ?? true);
    },
    splitTypes: (
      _: unknown,
      args: { active?: boolean },
      context: AuthContext,
    ) => {
      const service = new TaxonomyService(context.prisma);
      return service.splitTypes(args.active ?? true);
    },
  },
};