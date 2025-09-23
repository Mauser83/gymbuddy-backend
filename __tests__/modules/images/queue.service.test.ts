import { priorityFromSource } from '../../../src/modules/images/queue.service';

describe('priorityFromSource', () => {
  it.each([
    ['recognition_user', 100],
    ['gym_manager', 80],
    ['gym_equipment', 80],
    ['admin', 20],
    ['backfill', 20],
  ] as const)('returns %s priority %i', (source, expected) => {
    expect(priorityFromSource(source)).toBe(expected);
  });

  it('falls back to zero for unknown sources', () => {
    expect(priorityFromSource('unknown' as any)).toBe(0);
  });
});