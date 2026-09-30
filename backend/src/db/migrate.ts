import pool from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running database migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        slack_access_token TEXT,
        slack_channel_id VARCHAR(255),
        slack_team_id VARCHAR(255),
        slack_user_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ users table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS senders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        smtp_user VARCHAR(255) NOT NULL,
        smtp_pass VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, email)
      );
    `);
    console.log('✅ senders table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
        sender_email VARCHAR(255) NOT NULL,
        to_email VARCHAR(255) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
        bullmq_job_id VARCHAR(255),
        sent_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ email_jobs table ready');

    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id VARCHAR(255)');

    // Index for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_jobs_user_id ON email_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_scheduled_at ON email_jobs(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_email_jobs_sender_id ON email_jobs(sender_id);
    `);

    console.log('✅ Database migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
