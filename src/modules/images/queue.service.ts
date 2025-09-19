export function priorityFromSource(
  source: 'recognition_user' | 'gym_manager' | 'admin' | 'backfill' | 'gym_equipment',
): number {
  switch (source) {
    case 'recognition_user':
      return 100;
    case 'gym_manager':
    case 'gym_equipment':
      return 80;
    case 'admin':
    case 'backfill':
      return 20;
    default:
      return 0;
  }
}
