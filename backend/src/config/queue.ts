import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-send';

// Single shared queue instance - used by API routes to add jobs
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Prevent duplicate sends on retry by keeping track
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('Email queue error:', err);
});

console.log('✅ BullMQ email queue initialized');
