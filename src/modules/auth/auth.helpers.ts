import { compare, hash } from 'bcrypt';
import { verify } from 'jsonwebtoken';

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
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('JWT_SECRET not defined');
    return verify(token, jwtSecret) as {
      userId: number;
      email: string;
      role: string;
    };
  } catch {
    return null;
  }
};
