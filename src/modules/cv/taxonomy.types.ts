export interface BaseTaxonomy {
  id: number;
  key: string;
  label: string;
  description?: string;
  active: boolean;
  displayOrder: number;
}

export type AngleType = BaseTaxonomy;
export type HeightType = BaseTaxonomy;
export type LightingType = BaseTaxonomy;
export type MirrorType = BaseTaxonomy;
export type DistanceType = BaseTaxonomy;
export type SourceType = BaseTaxonomy;
export type SplitType = BaseTaxonomy;