import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { emitToUser } from '../realtime';
import { queueConnection } from './connection';
import type { NotificationJobData } from './notifications';

// Runs in the same Node process as the API server for this project's scale
// - a larger system would run this as its own deployable process (a
// separate container/pod that does nothing but drain this queue), so the
// API server's traffic and the worker's DB writes never compete for the
// same event loop. The QUEUE is what actually creates the decoupling here
// (enqueue and process are still two separate steps on two separate code
// paths) - which process happens to host the worker is an operational
// scaling detail, not what makes this "decoupled."
export function startNotificationsWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    'notifications',
    async (job) => {
      const notification = await prisma.notification.create({
        data: {
          type: job.data.type,
          message: job.data.message,
          userId: job.data.userId,
          organizationId: job.data.organizationId,
          taskId: job.data.taskId,
        },
      });
      emitToUser(job.data.userId, 'notification:created', notification);
    },
    { connection: queueConnection },
  );

  worker.on('failed', (job, err) => {
    // A failed job (e.g. a transient DB hiccup while writing the
    // notification row) is retried automatically per the attempts/backoff
    // set when the job was enqueued. Even if every retry is exhausted,
    // this never touches the original API request that triggered it - that
    // request already returned 201 to its caller before this job was even
    // picked up. Losing a notification is a real but much smaller problem
    // than losing (or blocking on) the task/comment action itself.
    console.error(`Notification job ${job?.id} failed after all retries:`, err.message);
  });

  return worker;
}
