import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import {
  generateRefreshTokenValue,
  hashToken,
  refreshTokenExpiryDate,
  signAccessToken,
  verifyAccessToken,
} from '../tokens';

const payload = { sub: 'user-1', organizationId: 'org-1', role: Role.DEVELOPER };

describe('access tokens', () => {
  it('round-trips: whatever is signed comes back out of verify', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('rejects a token signed with a different secret', () => {
    const foreignToken = jwt.sign(payload, 'a-different-secret');
    expect(() => verifyAccessToken(foreignToken)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(payload);
    const lastChar = token[token.length - 1];
    const tampered = token.slice(0, -1) + (lastChar === 'a' ? 'b' : 'a');
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '-1s' });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });
});

describe('refresh token values', () => {
  it('generates a long, unpredictable value each time', () => {
    const a = generateRefreshTokenValue();
    const b = generateRefreshTokenValue();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });

  it('hashes deterministically - same input, same hash, every time', () => {
    const value = generateRefreshTokenValue();
    expect(hashToken(value)).toEqual(hashToken(value));
  });

  it('produces a different hash for a different input', () => {
    expect(hashToken('a')).not.toEqual(hashToken('b'));
  });

  it('never stores the hash as the plain value itself', () => {
    const value = generateRefreshTokenValue();
    expect(hashToken(value)).not.toEqual(value);
  });

  it('computes an expiry date in the future', () => {
    expect(refreshTokenExpiryDate().getTime()).toBeGreaterThan(Date.now());
  });
});
