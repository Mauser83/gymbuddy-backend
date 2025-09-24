// DNS mocks rely on ambient Jest types and Node's dns promises module. The
// suite provides minimal manual typings to keep the focus on runtime behavior.
import { jest } from '@jest/globals';

type AsyncMock<Result = void, Args extends any[] = []> = jest.Mock<
  (...args: Args) => Promise<Result>
>;

const lookupMock: AsyncMock<{ address: string }[], [string, unknown?]> = jest.fn();

jest.mock('node:dns', () => ({
  promises: {
    lookup: lookupMock,
  },
}));

import { allResolvedIpsArePublic, isPublicIp } from '../../src/utils/ip-guard';

describe('ip guard utilities', () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it('detects invalid and private addresses as non-public', () => {
    expect(isPublicIp('not-an-ip')).toBe(false);
    expect(isPublicIp('192.168.1.5')).toBe(false);
    expect(isPublicIp('127.0.0.1')).toBe(false);
  });

  it('accepts globally routable addresses', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true);
    expect(isPublicIp('2001:4860:4860::8888')).toBe(true);
  });

  it('confirms all resolved addresses are public', async () => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8' }, { address: '1.1.1.1' }]);

    await expect(allResolvedIpsArePublic('example.com')).resolves.toBe(true);
  });

  it('flags hosts with private addresses', async () => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8' }, { address: '10.0.0.5' }]);

    await expect(allResolvedIpsArePublic('private.local')).resolves.toBe(false);
  });
});
