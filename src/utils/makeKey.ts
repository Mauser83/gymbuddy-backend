/* eslint-disable no-useless-escape */
export type KeyKind = "golden" | "training" | "upload";

export interface MakeKeyOptions {
  now?: Date;
  ext?: "jpg" | "png" | "webp";
  uuid?: string;
}

export type ParsedKey = {
  kind: KeyKind;
  equipmentId?: number;
  gymId?: number;
  year: number;
  month: number; // 1-12
  uuid: string;
  ext: "jpg" | "png" | "webp";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const exts = new Set(["jpg", "png", "webp"] as const);

function assertPositiveInt(name: string, value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    !Number.isFinite(value)
  ) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getUUID(override?: string) {
  if (override) {
    if (!UUID_RE.test(override)) throw new Error("uuid must be a valid UUID v4");
    return override;
  }
  // Node 18+ global, fallback for older runtimes
  const g: any = globalThis as any;
  const rand = g?.crypto?.randomUUID ?? require("crypto").randomUUID;
  return rand.call(g?.crypto ?? null);
}

export const KEY_REGEX = {
  golden:
    /^public\/golden\/(?<equipmentId>\d+)\/(?<yyyy>\d{4})\/(?<mm>\d{2})\/(?<uuid>[0-9a-f-]{36})\.(?<ext>jpg|png|webp)$/i,
  training:
    /^public\/training\/(?<equipmentId>\d+)\/(?<yyyy>\d{4})\/(?<mm>\d{2})\/(?<uuid>[0-9a-f-]{36})\.(?<ext>jpg|png|webp)$/i,
  upload:
    /^private\/uploads\/(?<gymId>\d+)\/(?<yyyy>\d{4})\/(?<mm>\d{2})\/(?<uuid>[0-9a-f-]{36})\.(?<ext>jpg|png|webp)$/i,
  any:
    /^(?:public\/(?:golden|training)\/\d+|private\/uploads\/\d+)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i,
};

export function makeKey(
  kind: KeyKind,
  ids: { equipmentId?: number; gymId?: number },
  opts: MakeKeyOptions = {}
): string {
  const now = opts.now ?? new Date();
  const yyyy = now.getUTCFullYear();
  const mm = now.getUTCMonth() + 1; // 1..12
  const ext = (opts.ext ?? "jpg").toLowerCase() as "jpg" | "png" | "webp";
  if (!exts.has(ext)) throw new Error(`ext must be one of: jpg, png, webp`);

  const uuid = getUUID(opts.uuid);

  if (kind === "upload") {
    assertPositiveInt("gymId", ids.gymId);
    return `private/uploads/${ids.gymId}/${yyyy}/${pad2(mm)}/${uuid}.${ext}`;
  }

  // golden/training
  assertPositiveInt("equipmentId", ids.equipmentId);
  const prefix = kind === "golden" ? "public/golden" : "public/training";
  return `${prefix}/${ids.equipmentId}/${yyyy}/${pad2(mm)}/${uuid}.${ext}`;
}

export function parseKey(key: string): ParsedKey | null {
  let m = key.match(KEY_REGEX.golden);
  if (m?.groups) {
    const { equipmentId, yyyy, mm, uuid, ext } = m.groups as any;
    return {
      kind: "golden",
      equipmentId: Number(equipmentId),
      year: Number(yyyy),
      month: Number(mm),
      uuid,
      ext: ext.toLowerCase(),
    } as ParsedKey;
  }
  m = key.match(KEY_REGEX.training);
  if (m?.groups) {
    const { equipmentId, yyyy, mm, uuid, ext } = m.groups as any;
    return {
      kind: "training",
      equipmentId: Number(equipmentId),
      year: Number(yyyy),
      month: Number(mm),
      uuid,
      ext: ext.toLowerCase(),
    } as ParsedKey;
  }
  m = key.match(KEY_REGEX.upload);
  if (m?.groups) {
    const { gymId, yyyy, mm, uuid, ext } = m.groups as any;
    return {
      kind: "upload",
      gymId: Number(gymId),
      year: Number(yyyy),
      month: Number(mm),
      uuid,
      ext: ext.toLowerCase(),
    } as ParsedKey;
  }
  return null;
}

export function isValidStorageKey(key: string): boolean {
  if (!KEY_REGEX.any.test(key)) return false;
  const parsed = parseKey(key);
  if (!parsed) return false;
  if (!(parsed.ext === "jpg" || parsed.ext === "png" || parsed.ext === "webp"))
    return false;
  if (parsed.month < 1 || parsed.month > 12) return false;
  if (!UUID_RE.test(parsed.uuid)) return false;
  if (parsed.kind !== "upload" && !parsed.equipmentId) return false;
  if (parsed.kind === "upload" && !parsed.gymId) return false;
  return true;
}

export function makeGymApprovedKey(
  gymId: number,
  ext: string,
  opts: MakeKeyOptions = {},
): string {
  assertPositiveInt("gymId", gymId);
  const now = opts.now ?? new Date();
  const yyyy = now.getUTCFullYear();
  const uuid = getUUID(opts.uuid);
  return `private/gym/${gymId}/approved/${yyyy}/${uuid}.${ext.toLowerCase()}`;
}

export function fileExtFrom(storageKey: string, mimeType?: string) {
  const fromKey = storageKey.split(".").pop();
  if (fromKey && fromKey.length <= 5) return fromKey.toLowerCase();
  if (!mimeType) return "jpg";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mimeType] ?? "jpg";
}