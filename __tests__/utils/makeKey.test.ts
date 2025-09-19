import {
  isValidStorageKey,
  makeKey,
  parseKey,
  makeGymApprovedKey,
  fileExtFrom,
} from '../../src/utils/makeKey';

const FIXED = new Date(Date.UTC(2025, 0, 5, 12, 34, 56)); // Jan (MM=01)
const FIX_UUID = '123e4567-e89b-4a12-9abc-1234567890ab'; // valid v4 shape

describe('makeKey', () => {
  it('creates upload key under private/uploads with gymId', () => {
    const key = makeKey('upload', { gymId: 7 }, { now: FIXED, uuid: FIX_UUID, ext: 'webp' });
    expect(key).toBe('private/uploads/7/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.webp');
    expect(isValidStorageKey(key)).toBe(true);
  });

  it('creates global upload key with equipmentId', () => {
    const key = makeKey('upload_global', { equipmentId: 9 }, { now: FIXED, uuid: FIX_UUID });
    expect(key).toBe('private/uploads/global/9/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg');
    expect(isValidStorageKey(key)).toBe(true);
  });

  it('rejects missing or invalid IDs', () => {
    // @ts-expect-error - gymId is required for upload keys
    expect(() => makeKey('upload', { equipmentId: 1 }, { now: FIXED })).toThrow(/gymId/);
    // @ts-expect-error - equipmentId is required for global uploads
    expect(() => makeKey('upload_global', { gymId: 1 }, { now: FIXED })).toThrow(/equipmentId/);
    // negative / non-integer
    expect(() => makeKey('upload_global', { equipmentId: 0 }, { now: FIXED })).toThrow(
      /positive integer/,
    );
    expect(() => makeKey('upload', { gymId: -2 }, { now: FIXED })).toThrow(/positive integer/);
  });

  it('rejects invalid ext and uuid', () => {
    // @ts-expect-error - invalid extension must throw
    expect(() => makeKey('upload', { gymId: 1 }, { now: FIXED, ext: 'gif' })).toThrow(
      /jpg, png, webp/,
    );
    expect(() => makeKey('upload', { gymId: 1 }, { now: FIXED, uuid: 'not-a-uuid' })).toThrow(
      /UUID v4/,
    );
  });
});

describe('makeGymApprovedKey', () => {
  it('creates approved key without month partition', () => {
    const key = makeGymApprovedKey(5, 'png', { now: FIXED, uuid: FIX_UUID });
    expect(key).toBe('private/gym/5/approved/2025/123e4567-e89b-4a12-9abc-1234567890ab.png');
  });
});

describe('fileExtFrom', () => {
  it('derives ext from key or mime type', () => {
    expect(fileExtFrom('foo/bar.jpg')).toBe('jpg');
    expect(fileExtFrom('foo/bar', 'image/png')).toBe('png');
    expect(fileExtFrom('foo/bar')).toBe('jpg');
  });
});

describe('parseKey & isValidStorageKey', () => {
  it('validates known-good keys', () => {
    const keys = [
      'public/golden/1/2025/12/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
      'public/training/22/2024/02/aaaaaaaa-aaaa-4aaa-9aaa-aaaaaaaaaaaa.png',
      'private/uploads/333/2023/11/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      'private/uploads/global/44/2025/01/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg',
      'private/global/equipment/55/approved/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    ];
    for (const k of keys) {
      expect(isValidStorageKey(k)).toBe(true);
      const parsed = parseKey(k)!;
      if (parsed.year != null && parsed.month != null) {
        expect(parsed.year).toBeGreaterThanOrEqual(2023);
        expect(parsed.month).toBeGreaterThanOrEqual(1);
        expect(parsed.month).toBeLessThanOrEqual(12);
      }
    }
  });

  it('rejects malformed keys', () => {
    const bad = [
      'public/golden//2025/01/x.jpg',
      'public/golden/1/2025/13/uuid.jpg', // bad month
      'private/uploads/notint/2025/01/uuid.jpg', // non-int
      'private/uploads/1/2025/01/not-a-uuid.jpg',
      'public/unknown/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
      'public/golden/1/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.gif',
      'private/uploads/global/x/2025/01/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
    ];
    for (const k of bad) expect(isValidStorageKey(k)).toBe(false);
  });
});
