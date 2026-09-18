import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { verifyAccessToken } from './lib/tokens';
import { prisma } from './prisma';

type SocketUser = { id: string; organizationId: string; role: Role };

let io: SocketIOServer | undefined;

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // A socket connection is authenticated once, at handshake time, using the
  // same JWT the REST API uses - not re-checked on every message. Unlike an
  // HTTP request, a socket is a long-lived connection; re-verifying a token
  // per-message would only matter if we needed to force an established
  // connection closed the instant a token expires mid-session, which this
  // project doesn't need (a client that gets disconnected for any reason
  // reconnects with a fresh token automatically - see the frontend socket
  // client).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') {
      next(new Error('Missing access token'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      const user: SocketUser = { id: payload.sub, organizationId: payload.organizationId, role: payload.role };
      (socket.data as { user: SocketUser }).user = user;
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    // Room membership is authorization, not just organization - a socket can
    // only join a project's room if that project actually belongs to the
    // connected user's organization. Without this check, "rooms" would be
    // purely a broadcast-efficiency mechanism, not an isolation boundary.
    socket.on('join-project', async (projectId: unknown) => {
      if (typeof projectId !== 'string') return;
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId: user.organizationId },
      });
      if (!project) return;
      socket.join(`project:${projectId}`);
    });

    socket.on('leave-project', (projectId: unknown) => {
      if (typeof projectId !== 'string') return;
      socket.leave(`project:${projectId}`);
    });
  });

  return io;
}

// Scoped to one project's room, not a global broadcast - a client watching
// project A has no reason to receive events for project B, and broadcasting
// everywhere would mean every connected client processes every event in the
// whole organization (or worse, the whole platform) regardless of relevance.
export function emitToProject(projectId: string, event: string, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
}
