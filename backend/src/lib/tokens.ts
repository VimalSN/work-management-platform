import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const ACCESS_SECRET = requireEnv('JWT_ACCESS_SECRET');

const ACCESS_TOKEN_TTL = `${process.env.ACCESS_TOKEN_TTL_MINUTES || '15'}m`;
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || '7');

export type AccessTokenPayload = {
  sub: string;
  organizationId: string;
  role: Role;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

// The refresh token is a random opaque value, not a JWT: unlike an access
// token, it must be revocable server-side (e.g. on logout or reuse
// detection), which only works if the server holds a record of it.
export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function refreshTokenExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return date;
}
