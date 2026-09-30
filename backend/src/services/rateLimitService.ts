import redis from '../config/redis';
import pool from '../config/db';
import { sendSlackNotification } from './slackService';
import dotenv from 'dotenv';

dotenv.config();

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MAX_EMAILS_PER_HOUR_PER_SENDER = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50');

/**
 * Get the current hour window key (e.g. "2024:01:15:14" for 2024-01-15 at 14:xx)
 */
function getHourWindow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}:${String(now.getUTCMonth() + 1).padStart(2, '0')}:${String(now.getUTCDate()).padStart(2, '0')}:${String(now.getUTCHours()).padStart(2, '0')}`;
}

/**
 * Get the start of the NEXT hour window in milliseconds (for scheduling delayed jobs)
 */
export function getNextHourWindowMs(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime();
}

/**
 * Check if a sender has hit its hourly rate limit.
 * Uses Redis atomic INCR + EXPIRY to safely count across multiple workers.
 * 
 * Returns: { allowed: boolean, current: number, limit: number, nextWindowMs: number }
 */
export async function checkAndIncrementRateLimit(
  senderEmail: string,
  userId: string,
  senderLimit = MAX_EMAILS_PER_HOUR_PER_SENDER
): Promise<{ allowed: boolean; current: number; limit: number; nextWindowMs: number }> {
  const window = getHourWindow();
  const key = `rate_limit:${userId}:${senderEmail}:${window}`;

  // Atomically increment counter. INCR returns new value.
  const current = await redis.incr(key);

  // Set TTL to 2 hours so Redis cleans up old keys automatically
  if (current === 1) {
    await redis.expire(key, 7200);
  }

  const limit = senderLimit;
  const allowed = current <= limit;
  const nextWindowMs = getNextHourWindowMs();

  // Notify only on the first rejected job in the hour to avoid Slack spam.
  if (current === limit + 1 && await redis.set(`rate_limit_notification:${key}`, '1', 'EX', 7200, 'NX')) {
    // Notify Slack if sender's rate limit is hit
    try {
      const userResult = await pool.query(
        'SELECT slack_access_token, slack_channel_id, slack_user_id FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      if (user?.slack_access_token) {
        await sendSlackNotification(
          user.slack_access_token,
          user.slack_channel_id,
          `⚠️ Rate limit reached for sender *${senderEmail}*: ${current}/${limit} emails sent this hour. Remaining emails will be delayed to the next hour.`
          ,
          user.slack_user_id
        );
      }
    } catch (slackErr) {
      // Don't crash if Slack notification fails
      console.warn('Slack notification failed (rate limit):', slackErr);
    }
  }

  return { allowed, current, limit, nextWindowMs };
}

/**
 * Decrement rate limit counter (used when a job gets delayed - it wasn't actually sent)
 */
export async function decrementRateLimit(senderEmail: string, userId: string): Promise<void> {
  const window = getHourWindow();
  const key = `rate_limit:${userId}:${senderEmail}:${window}`;
  await redis.decr(key);
}

/**
 * Get current rate limit status for a sender (read-only, no increment)
 */
export async function getRateLimitStatus(
  senderEmail: string,
  userId: string
): Promise<{ current: number; limit: number; window: string }> {
  const window = getHourWindow();
  const key = `rate_limit:${userId}:${senderEmail}:${window}`;
  const current = parseInt((await redis.get(key)) || '0');
  return { current, limit: MAX_EMAILS_PER_HOUR_PER_SENDER, window };
}
