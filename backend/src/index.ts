import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './prisma';
import { redis } from './redis';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
