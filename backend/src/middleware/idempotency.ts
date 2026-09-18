import { NextFunction, Response } from 'express';
import { redis } from '../redis';
import { AuthenticatedRequest } from './auth';

const TTL_SECONDS = 24 * 60 * 60;

// Protects against the SAME logical request being processed twice - e.g. a
// flaky connection causing the browser to resend a POST it never got a
// response for. This is a different problem from a human double-clicking a
// button (which a disabled-while-pending submit button already prevents at
// the UI layer): a network-level retry carries no visible sign to the user
// that anything was resent, so it needs a server-side safeguard instead.
export function idempotent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string') {
    next();
    return;
  }

  const redisKey = `idempotency:${req.user!.organizationId}:${key}`;

  redis
    .get(redisKey)
    .then((cached) => {
      if (cached) {
        const { status, body } = JSON.parse(cached);
        res.status(status).json(body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        // Only remember a successful creation - a validation error or
        // conflict shouldn't be replayed as "the" answer for this key on a
        // later, possibly-now-valid retry.
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis
            .set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
            .catch(() => {});
        }
        return originalJson(body);
      };

      next();
    })
    .catch(() => {
      // Redis being unreachable should never block task creation - fail
      // open and process the request normally, same as the /health check's
      // approach to a down dependency.
      next();
    });
}
