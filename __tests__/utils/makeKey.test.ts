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
    // Intentionally omit the required gymId to ensure runtime validation triggers.
    expect(() => makeKey('upload', { equipmentId: 1 }, { now: FIXED })).toThrow(/gymId/);
    // Intentionally omit the required equipmentId to ensure runtime validation triggers.
    expect(() => makeKey('upload_global', { gymId: 1 }, { now: FIXED })).toThrow(/equipmentId/);
    // negative / non-integer
    expect(() => makeKey('upload_global', { equipmentId: 0 }, { now: FIXED })).toThrow(
      /positive integer/,
    );
    expect(() => makeKey('upload', { gymId: -2 }, { now: FIXED })).toThrow(/positive integer/);
  });

  it('rejects invalid ext and uuid', () => {
    expect(() => makeKey('upload', { gymId: 1 }, { now: FIXED, ext: 'gif' as any })).toThrow(
      /jpg, png, webp/,
    );
    expect(() => makeKey('upload', { gymId: 1 }, { now: FIXED, uuid: 'not-a-uuid' })).toThrow(
      /UUID v4/,
    );
  });

  it('throws for unsupported key kinds', () => {
    expect(() => makeKey('golden' as any, { gymId: 1 }, { now: FIXED })).toThrow(
      /Unsupported key kind/,
    );
  });
});

describe('makeGymApprovedKey', () => {
  it('creates approved key without month partition', () => {
    const key = makeGymApprovedKey(5, 'png', { now: FIXED, uuid: FIX_UUID });
    expect(key).toBe('private/gym/5/approved/2025/123e4567-e89b-4a12-9abc-1234567890ab.png');
  });

  it('requires a positive integer gym identifier', () => {
    expect(() => makeGymApprovedKey(0 as any, 'jpg')).toThrow(/positive integer/);
    expect(() => makeGymApprovedKey(-1 as any, 'jpg')).toThrow(/positive integer/);
  });
});

describe('fileExtFrom', () => {
  it('derives ext from key or mime type', () => {
    expect(fileExtFrom('foo/bar.jpg')).toBe('jpg');
    expect(fileExtFrom('foo/bar', 'image/png')).toBe('png');
    expect(fileExtFrom('foo/bar')).toBe('jpg');
  });

  it('prefers mime type when the key suffix is too long to trust', () => {
    expect(fileExtFrom('foo/bar.longextension', 'image/webp')).toBe('webp');
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
      'private/gym/0/approved/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
      'private/global/equipment/0/approved/123e4567-e89b-4a12-9abc-1234567890ab.jpg',
    ];
    for (const k of bad) expect(isValidStorageKey(k)).toBe(false);
  });

  it('extracts uuid or sha fields for equipment approval keys', () => {
    const uuidKey = 'private/global/equipment/12/quarantine/123e4567-e89b-4a12-9abc-1234567890ab.png';
    const sha = 'a'.repeat(64);
    const shaKey = `private/global/equipment/12/approved/${sha}.jpg`;

    expect(parseKey(uuidKey)).toEqual({
      kind: 'quarantine_global',
      equipmentId: 12,
      uuid: '123e4567-e89b-4a12-9abc-1234567890ab',
      sha: undefined,
      ext: 'png',
    });

    expect(parseKey(shaKey)).toEqual({
      kind: 'approved_global',
      equipmentId: 12,
      uuid: undefined,
      sha,
      ext: 'jpg',
    });
  });

  it('extracts uuid or sha fields for gym approval keys', () => {
    const uuidKey = 'private/gym/77/approved/123e4567-e89b-4a12-9abc-1234567890ab.jpg';
    const sha = 'b'.repeat(64);
    const shaKey = `private/gym/77/quarantine/${sha}.webp`;

    expect(parseKey(uuidKey)).toEqual({
      kind: 'approved_gym',
      gymEquipmentId: 77,
      uuid: '123e4567-e89b-4a12-9abc-1234567890ab',
      sha: undefined,
      ext: 'jpg',
    });

    expect(parseKey(shaKey)).toEqual({
      kind: 'quarantine_gym',
      gymEquipmentId: 77,
      uuid: undefined,
      sha,
      ext: 'webp',
    });
  });

  it('rejects approval keys missing required identifiers', () => {
    expect(
      isValidStorageKey('private/global/equipment//approved/123e4567-e89b-4a12-9abc-1234567890ab.jpg'),
    ).toBe(false);
    expect(
      isValidStorageKey('private/gym//quarantine/123e4567-e89b-4a12-9abc-1234567890ab.jpg'),
    ).toBe(false);
  });
});

describe('uuid generation fallbacks', () => {
  const originalCrypto = global.crypto;

  afterEach(() => {
    if (originalCrypto) {
      (global as any).crypto = originalCrypto;
    } else {
      delete (global as any).crypto;
    }
    jest.resetModules();
    jest.unmock('crypto');
  });

  it('uses node randomUUID when web crypto is unavailable', () => {
    const nodeRandomUUID = jest.fn().mockReturnValue('node-based-uuid');

    jest.isolateModules(() => {
      jest.doMock('crypto', () => ({ randomUUID: nodeRandomUUID }));
      delete (global as any).crypto;

      const mod = require('../../src/utils/makeKey') as typeof import('../../src/utils/makeKey');
      const key = mod.makeKey('upload', { gymId: 11 }, { now: FIXED, ext: 'png' });

      expect(nodeRandomUUID).toHaveBeenCalledTimes(1);
      expect(key).toContain('node-based-uuid.png');
    });
  });

  it('prefers web crypto randomUUID when available', () => {
    const nodeRandomUUID = jest.fn().mockReturnValue('node-based-uuid');
    const webRandomUUID = jest.fn().mockReturnValue('web-uuid');

    jest.isolateModules(() => {
      jest.doMock('crypto', () => ({ randomUUID: nodeRandomUUID }));
      (global as any).crypto = { randomUUID: webRandomUUID };

      const mod = require('../../src/utils/makeKey') as typeof import('../../src/utils/makeKey');
      const key = mod.makeKey('upload', { gymId: 12 }, { now: FIXED, ext: 'png' });

      expect(webRandomUUID).toHaveBeenCalledTimes(1);
      expect(nodeRandomUUID).not.toHaveBeenCalled();
      expect(key).toContain('web-uuid.png');
    });
  });
});