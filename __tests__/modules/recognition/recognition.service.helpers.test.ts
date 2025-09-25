import { describe, expect, it } from '@jest/globals';

const loadModule = () => require('../../../src/modules/recognition/recognition.service') as any;

describe('recognition service helpers', () => {
  it('groups equipment images with defaults and marks low confidence', () => {
    const { groupTopEquipment } = loadModule();

    const items = [
      { equipmentId: 1, gymId: 10, storageKey: 'k1', score: 0.6, imageId: 'a' },
      { equipmentId: 1, gymId: null, storageKey: 'k2', score: 0.55, imageId: 'b' },
      { equipmentId: 2, gymId: 11, storageKey: 'k3', score: 0.9, imageId: 'c' },
      { equipmentId: 2, gymId: 12, storageKey: 'k4', score: 0.4, imageId: 'd' },
    ];

    const grouped = groupTopEquipment(items);

    expect(grouped).toHaveLength(2);

    const [first, second] = grouped;
    expect(first.equipmentId).toBe(2);
    expect(first.representative).toMatchObject({ imageId: 'c', gymId: 11, score: 0.9 });
    expect(first.lowConfidence).toBe(false);
    expect(first.images).toHaveLength(2);
    expect(first.source).toBe('GYM');
    expect(first.totalImagesConsidered).toBe(items.length);

    expect(second.equipmentId).toBe(1);
    expect(second.lowConfidence).toBe(true);
    expect(second.representative).toMatchObject({ imageId: 'a', gymId: 10, score: 0.6 });
    expect(second.images[1]).toMatchObject({ imageId: 'b', gymId: null, storageKey: 'k2' });
  });

  it('respects grouping options and ignores excess images per equipment', () => {
    const { groupTopEquipment } = loadModule();

    const items = [
      { equipmentId: 3, gymId: undefined, storageKey: 'k5', score: 0.95, imageId: 'e' },
      { equipmentId: 3, gymId: undefined, storageKey: 'k6', score: 0.7, imageId: 'f' },
      { equipmentId: 3, gymId: undefined, storageKey: 'k7', score: 0.5, imageId: 'g' },
    ];

    const grouped = groupTopEquipment(items, { keepPerEq: 2, source: 'GLOBAL', totalImages: 99 });

    expect(grouped).toHaveLength(1);
    const [only] = grouped;
    expect(only.images).toHaveLength(2);
    expect(only.images.map((img: any) => img.imageId)).toEqual(['e', 'f']);
    expect(only.totalImagesConsidered).toBe(99);
    expect(only.source).toBe('GLOBAL');
  });
});

describe('inferContentType', () => {
  it('maps known extensions to image mime types and defaults otherwise', () => {
    const { inferContentType } = loadModule();

    expect(inferContentType('jpg')).toBe('image/jpeg');
    expect(inferContentType('jpeg')).toBe('image/jpeg');
    expect(inferContentType('png')).toBe('image/png');
    expect(inferContentType('webp')).toBe('image/webp');
    expect(inferContentType('heic')).toBe('image/heic');
    expect(inferContentType('tiff')).toBe('application/octet-stream');
  });
});
