import { isValidStorageKey, makeKey, parseKey } from "../../src/utils/makeKey";

const FIXED = new Date(Date.UTC(2025, 0, 5, 12, 34, 56)); // Jan (MM=01)
const FIX_UUID = "123e4567-e89b-4a12-9abc-1234567890ab"; // valid v4 shape

describe("makeKey", () => {
  it("creates golden key with UTC partition and zero-padded month", () => {
    const key = makeKey("golden", { equipmentId: 42 }, { now: FIXED, uuid: FIX_UUID });
    expect(key).toBe(
      "public/golden/42/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg"
    );
    expect(isValidStorageKey(key)).toBe(true);
  });

  it("creates training key (png) and parses back", () => {
    const key = makeKey("training", { equipmentId: 99 }, { now: FIXED, uuid: FIX_UUID, ext: "png" });
    expect(key.endsWith(".png")).toBe(true);
    const parsed = parseKey(key)!;
    expect(parsed.kind).toBe("training");
    expect(parsed.equipmentId).toBe(99);
    expect(parsed.year).toBe(2025);
    expect(parsed.month).toBe(1);
    expect(parsed.ext).toBe("png");
    expect(parsed.uuid).toBe(FIX_UUID);
  });

  it("creates upload key under private/uploads with gymId", () => {
    const key = makeKey("upload", { gymId: 7 }, { now: FIXED, uuid: FIX_UUID, ext: "webp" });
    expect(key).toBe(
      "private/uploads/7/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.webp"
    );
    expect(isValidStorageKey(key)).toBe(true);
  });

  it("rejects missing or invalid IDs", () => {
    // @ts-expect-error
    expect(() => makeKey("golden", { gymId: 1 }, { now: FIXED })).toThrow(/equipmentId/);
    // @ts-expect-error
    expect(() => makeKey("upload", { equipmentId: 1 }, { now: FIXED })).toThrow(/gymId/);
    // negative / non-integer
    expect(() => makeKey("training", { equipmentId: 0 }, { now: FIXED })).toThrow(/positive integer/);
    expect(() => makeKey("upload", { gymId: -2 }, { now: FIXED })).toThrow(/positive integer/);
  });

  it("rejects invalid ext and uuid", () => {
    // @ts-expect-error
    expect(() => makeKey("golden", { equipmentId: 1 }, { now: FIXED, ext: "gif" })).toThrow(/jpg, png, webp/);
    expect(() =>
      makeKey("golden", { equipmentId: 1 }, { now: FIXED, uuid: "not-a-uuid" })
    ).toThrow(/UUID v4/);
  });
});

describe("parseKey & isValidStorageKey", () => {
  it("validates known-good keys", () => {
    const keys = [
      "public/golden/1/2025/12/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      "public/training/22/2024/02/aaaaaaaa-aaaa-4aaa-9aaa-aaaaaaaaaaaa.png",
      "private/uploads/333/2023/11/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp",
    ];
    for (const k of keys) {
      expect(isValidStorageKey(k)).toBe(true);
      const parsed = parseKey(k)!;
      expect(parsed.year).toBeGreaterThanOrEqual(2023);
      expect(parsed.month).toBeGreaterThanOrEqual(1);
      expect(parsed.month).toBeLessThanOrEqual(12);
    }
  });

  it("rejects malformed keys", () => {
    const bad = [
      "public/golden//2025/01/x.jpg",
      "public/golden/1/2025/13/uuid.jpg", // bad month
      "private/uploads/notint/2025/01/uuid.jpg", // non-int
      "private/uploads/1/2025/01/not-a-uuid.jpg",
      "public/unknown/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg",
      "public/golden/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.gif",
    ];
    for (const k of bad) expect(isValidStorageKey(k)).toBe(false);
  });
});