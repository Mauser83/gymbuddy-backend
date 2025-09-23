import { jest } from '@jest/globals';

import { startMemoryLogger } from '../../src/utils/memoryTracker';

describe('memory tracker', () => {
  const originalResourceUsage = process.resourceUsage;

  afterEach(() => {
    jest.restoreAllMocks();
    process.resourceUsage = originalResourceUsage;
  });

  it('schedules logging and leaves the timer unreferenced', () => {
    const unrefSpy = jest.fn();
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      fn();
      return { unref: unrefSpy } as unknown as NodeJS.Timeout;
    }) as any);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest
      .spyOn(process, 'resourceUsage')
      .mockReturnValue({ maxRSS: 3_145_728 } as ReturnType<typeof process.resourceUsage>);

    startMemoryLogger(1234);

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 1234);
    expect(unrefSpy).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('[Memory] Peak RSS: 3072.00 MB');
  });
});