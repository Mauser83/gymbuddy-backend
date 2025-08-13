export type TaxonomyKind =
  | "ANGLE"
  | "HEIGHT"
  | "LIGHTING"
  | "MIRROR"
  | "DISTANCE"
  | "SOURCE"
  | "SPLIT";

export interface TaxonomyType {
  id: number;
  key: string;
  label: string;
  description?: string;
  active: boolean;
  displayOrder: number;
  kind: TaxonomyKind;
}