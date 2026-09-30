import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../config/db';
import { emailQueue } from '../config/queue';
import { indexEmail } from '../services/elasticsearchService';
import { searchEmails } from '../services/elasticsearchService';
import { EmailJobData } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails for one or more recipients.
 * 
 * Body:
 * {
 *   sender_id: string,
 *   recipients: string[],       // email addresses
 *   subject: string,
 *   body: string,
 *   scheduled_at: string,       // ISO datetime
 *   delay_between_emails: number, // seconds
 *   hourly_limit: number
 * }
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const {
      sender_id,
      recipients,
      subject,
      body,
      scheduled_at,
      delay_between_emails = 2,
      hourly_limit,
    } = req.body;

    if (!sender_id || !recipients?.length || !subject || !body || !scheduled_at) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate sender belongs to this user
    const senderResult = await pool.query(
      'SELECT * FROM senders WHERE id = $1 AND user_id = $2',
      [sender_id, userId]
    );
    if (!senderResult.rows.length) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    const senderHourlyLimit = Number(hourly_limit ?? process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 50);
    if (!Number.isInteger(senderHourlyLimit) || senderHourlyLimit < 1) {
      return res.status(400).json({ error: 'hourly_limit must be a positive integer' });
    }
    const sender = senderResult.rows[0];

    const scheduledAt = new Date(scheduled_at);
    const now = new Date();
    const scheduledJobs: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const toEmail = recipients[i].trim();
      if (!toEmail) continue;

      // Calculate per-recipient delay: base scheduled_at + delay_between_emails * index
      const jobScheduledAt = new Date(
        scheduledAt.getTime() + i * delay_between_emails * 1000
      );
      const delayMs = Math.max(0, jobScheduledAt.getTime() - now.getTime());

      // Create DB record first
      const emailJobId = uuidv4();
      await pool.query(
        `INSERT INTO email_jobs 
           (id, user_id, sender_id, sender_email, to_email, subject, body, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')`,
        [emailJobId, userId, sender_id, sender.email, toEmail, subject, body, jobScheduledAt]
      );

      // Prepare job data
      const jobData: EmailJobData = {
        email_job_id: emailJobId,
        sender_id,
        sender_email: sender.email,
        smtp_user: sender.smtp_user,
        smtp_pass: sender.smtp_pass,
        to_email: toEmail,
        subject,
        body,
        user_id: userId,
        hourly_limit: senderHourlyLimit,
      };

      // Add to BullMQ with delay
      // jobId = emailJobId ensures idempotency (BullMQ won't add duplicate job IDs)
      await emailQueue.add(`email:${emailJobId}`, jobData, {
        delay: delayMs,
        jobId: emailJobId,  // IDEMPOTENCY KEY
      });

      // Index in Elasticsearch
      await indexEmail({
        id: emailJobId,
        user_id: userId,
        sender_id,
        sender_email: sender.email,
        to_email: toEmail,
        subject,
        body,
        scheduled_at: jobScheduledAt,
        status: 'scheduled',
        bullmq_job_id: emailJobId,
        sent_at: null,
        error_message: null,
        created_at: now,
      });

      scheduledJobs.push(emailJobId);
    }

    res.status(201).json({
      message: `${scheduledJobs.length} email(s) scheduled successfully`,
      job_ids: scheduledJobs,
    });
  } catch (err) {
    console.error('Schedule email error:', err);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

/**
 * GET /api/emails/scheduled
 * Get all scheduled (pending) emails for the current user.
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await pool.query(
      `SELECT ej.*, s.name as sender_name
       FROM email_jobs ej
       JOIN senders s ON ej.sender_id = s.id
       WHERE ej.user_id = $1 AND ej.status IN ('scheduled', 'delayed')
       ORDER BY ej.scheduled_at ASC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('scheduled', 'delayed')`,
      [userId]
    );

    res.json({
      emails: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('Get scheduled emails error:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * Get all sent/failed emails for the current user.
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const { page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await pool.query(
      `SELECT ej.*, s.name as sender_name
       FROM email_jobs ej
       JOIN senders s ON ej.sender_id = s.id
       WHERE ej.user_id = $1 AND ej.status IN ('sent', 'failed')
       ORDER BY ej.sent_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM email_jobs WHERE user_id = $1 AND status IN ('sent', 'failed')`,
      [userId]
    );

    res.json({
      emails: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('Get sent emails error:', err);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/search?q=...&status=...
 * Full-text search emails via Elasticsearch.
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const { q = '', status, page = '1', limit = '20' } = req.query;
    const from = (parseInt(page as string) - 1) * parseInt(limit as string);

    const results = await searchEmails(
      userId,
      q as string,
      status as string | undefined,
      from,
      parseInt(limit as string)
    );

    res.json(results);
  } catch (err) {
    console.error('Search emails error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/emails/stats
 * Dashboard statistics.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;

    const result = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         COUNT(*) FILTER (WHERE status = 'delayed') as delayed,
         COUNT(*) as total
       FROM email_jobs
       WHERE user_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
