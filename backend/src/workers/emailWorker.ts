import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EMAIL_QUEUE_NAME, emailQueue } from '../config/queue';
import { sendEmail } from '../services/emailService';
import { checkAndIncrementRateLimit, decrementRateLimit, getNextHourWindowMs } from '../services/rateLimitService';
import { updateEmailIndex } from '../services/elasticsearchService';
import pool from '../config/db';
import { EmailJobData } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');
const MIN_SEND_DELAY_MS = parseInt(process.env.MIN_SEND_DELAY_MS || '2000');

/**
 * The BullMQ worker processes email send jobs.
 * 
 * Flow:
 * 1. Check rate limit for this sender (Redis-backed, atomic)
 * 2. If limit exceeded → delay job to next hour window (not dropped)
 * 3. If within limit → send email via Ethereal SMTP
 * 4. Update DB + Elasticsearch with result
 * 5. Minimum delay between sends enforced by `limiter` option
 */
export function createEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const {
        email_job_id,
        sender_id,
        sender_email,
        smtp_user,
        smtp_pass,
        to_email,
        subject,
        body,
        user_id,
        hourly_limit,
      } = job.data;

      console.log(`🔄 Processing job ${job.id} → ${to_email}`);

      // ── Idempotency check ──
      // If this email was already sent, skip it (handles restart/retry scenarios)
      const existing = await pool.query(
        'SELECT status, sent_at FROM email_jobs WHERE id = $1',
        [email_job_id]
      );
      // A status label by itself is not proof of delivery. Only skip retries
      // when the row has the durable send timestamp written after SMTP succeeds.
      if (existing.rows[0]?.status === 'sent' && existing.rows[0]?.sent_at) {
        console.log(`⏭️  Job ${job.id} already sent, skipping`);
        return;
      }

      // ── Rate limit check ──
      const { allowed, current, limit, nextWindowMs } = await checkAndIncrementRateLimit(
        sender_email,
        user_id,
        hourly_limit
      );

      if (!allowed) {
        // Decrement the counter since we're not actually sending now
        await decrementRateLimit(sender_email, user_id);

        // Calculate delay to next hour window
        const delayMs = nextWindowMs - Date.now();
        console.log(
          `⏳ Rate limit hit (${current - 1}/${limit}) for ${sender_email}. ` +
          `Rescheduling job in ${Math.round(delayMs / 1000)}s`
        );

        // Update DB status to 'delayed'
        await pool.query(
          `UPDATE email_jobs SET status = 'delayed' WHERE id = $1`,
          [email_job_id]
        );
        await updateEmailIndex(email_job_id, { status: 'delayed' });

        // Add a NEW delayed job (with same data, new job ID) for next hour
        // We add it back with a delay so order is preserved as much as possible
        await emailQueue.add(`email:${email_job_id}:retry`, job.data, {
          delay: delayMs,
          // Use a unique job ID that includes a timestamp so it's not blocked by
          // BullMQ's duplicate check, but links back to the same DB record
          jobId: `${email_job_id}:retry:${nextWindowMs}`,
        });

        return { delayed: true, scheduledFor: new Date(nextWindowMs).toISOString() };
      }

      // ── Send the email ──
      try {
        const { messageId, previewUrl } = await sendEmail(
          smtp_user,
          smtp_pass,
          sender_email,
          to_email,
          subject,
          body
        );

        // Update DB to 'sent'
        await pool.query(
          `UPDATE email_jobs 
           SET status = 'sent', sent_at = NOW(), bullmq_job_id = $1
           WHERE id = $2`,
          [messageId, email_job_id]
        );

        // Update Elasticsearch
        await updateEmailIndex(email_job_id, {
          status: 'sent',
          sent_at: new Date(),
        });

        console.log(`✅ Sent ${to_email} | msgId: ${messageId} | preview: ${previewUrl}`);
        return { sent: true, messageId, previewUrl };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`❌ Failed to send to ${to_email}:`, errorMessage);

        // Update DB to 'failed'
        await pool.query(
          `UPDATE email_jobs 
           SET status = 'failed', error_message = $1
           WHERE id = $2`,
          [errorMessage, email_job_id]
        );

        await updateEmailIndex(email_job_id, {
          status: 'failed',
          error_message: errorMessage,
        } as any);

        throw err; // BullMQ will retry based on job options
      }
    },
    {
      connection: redisConnection,
      concurrency: WORKER_CONCURRENCY,
      // Enforce minimum delay between sends at the queue level
      // This ensures no more than 1 email per MIN_SEND_DELAY_MS globally
      limiter: {
        max: 1,
        duration: MIN_SEND_DELAY_MS,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed:`, JSON.stringify(result));
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(
    `✅ Email worker started | concurrency: ${WORKER_CONCURRENCY} | min delay: ${MIN_SEND_DELAY_MS}ms`
  );
  return worker;
}
