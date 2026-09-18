import { Queue } from 'bullmq';
import { NotificationType } from '@prisma/client';
import { queueConnection } from './connection';

export type NotificationJobData = {
  userId: string;
  organizationId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
};

export const notificationsQueue = new Queue<NotificationJobData>('notifications', {
  connection: queueConnection,
});

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  try {
    await notificationsQueue.add('notify', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  } catch (err) {
    // Enqueueing is fire-and-forget from the caller's point of view: if
    // Redis itself is unreachable, log it and move on rather than failing
    // the task/comment action that triggered this. The user's actual
    // request already succeeded - a missed notification is a much smaller
    // problem than reporting a failure for something that actually worked.
    console.error('Failed to enqueue notification:', err);
  }
}
