import jwt from 'jsonwebtoken';

import { comparePassword, hashPassword, verifyToken } from '../../../src/modules/auth/auth.helpers';

process.env.JWT_SECRET = 'testsecret';

describe('auth.helpers', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'testsecret';
  });

  test('hashPassword and comparePassword work correctly', async () => {
    const password = 'mypassword';
    const hashed = await hashPassword(password);
    expect(hashed).not.toBe(password);
    expect(await comparePassword(password, hashed)).toBe(true);
    expect(await comparePassword('wrong', hashed)).toBe(false);
  });

  test('verifyToken returns payload for valid token', () => {
    const token = jwt.sign(
      { userId: 1, email: 'a@example.com', role: 'USER' },
      process.env.JWT_SECRET!,
    );
    expect(verifyToken(token)).toEqual(
      expect.objectContaining({ userId: 1, email: 'a@example.com', role: 'USER' }),
    );
  });

  test('verifyToken returns null for invalid token', () => {
    expect(verifyToken('invalid.token')).toBeNull();
  });
});
