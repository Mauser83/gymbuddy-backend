import { compare, hash } from 'bcrypt';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../../server';

const saltRounds = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return hash(password, saltRounds);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return compare(password, hashedPassword);
};

export const verifyToken = (
  token: string,
): { userId: number; email: string; role: string } | null => {
  try {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not defined');
    return verify(token, JWT_SECRET) as {
      userId: number;
      email: string;
      role: string;
    };
  } catch {
    return null;
  }
};
