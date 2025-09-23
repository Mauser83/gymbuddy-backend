import { priorityFromSource } from '../../../src/modules/images/queue.service';

describe('priorityFromSource', () => {
  it('returns high priority for recognition user jobs', () => {
    expect(priorityFromSource('recognition_user')).toBe(100);
  });

  it('gives medium priority for gym submissions', () => {
    expect(priorityFromSource('gym_manager')).toBe(80);
    expect(priorityFromSource('gym_equipment')).toBe(80);
  });

  it('returns lower priority for admin and backfill', () => {
    expect(priorityFromSource('admin')).toBe(20);
    expect(priorityFromSource('backfill')).toBe(20);
  });

  it('defaults to zero for unknown sources', () => {
    expect(priorityFromSource('something_else' as any)).toBe(0);
  });
});