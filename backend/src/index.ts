import 'dotenv/config';
import { createServer } from 'http';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { prisma } from './prisma';
import { redis } from './redis';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import usersRouter from './routes/users';
import notificationsRouter from './routes/notifications';
import workloadRouter from './routes/workload';
import { initRealtime } from './realtime';
import { startNotificationsWorker } from './queue/notificationsWorker';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// credentials: true + an explicit origin (not "*") is required for the
// browser to send/receive the httpOnly refresh-token cookie cross-origin.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/tasks', tasksRouter);
app.use('/users', usersRouter);
app.use('/notifications', notificationsRouter);
app.use('/workload', workloadRouter);

app.get('/health', async (_req, res) => {
  const status = { server: 'ok', database: 'unknown', redis: 'unknown' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.database = 'ok';
  } catch (err) {
    status.database = 'error';
  }

  try {
    await redis.ping();
    status.redis = 'ok';
  } catch (err) {
    status.redis = 'error';
  }

  const allOk = status.database === 'ok' && status.redis === 'ok';
  res.status(allOk ? 200 : 503).json(status);
});

// Must be registered after all routes. Express recognizes an error handler
// by its 4-argument signature. Without this, an unhandled error (e.g. the
// database being unreachable) falls through to Express's default HTML error
// page, which also leaks internal file paths and stack traces to the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

initRealtime(httpServer);
startNotificationsWorker();

httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
