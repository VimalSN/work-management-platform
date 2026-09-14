import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../lib/tokens';

export type AuthenticatedRequest = Request & {
  user?: { id: string; organizationId: string; role: Role };
};

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, organizationId: payload.organizationId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
