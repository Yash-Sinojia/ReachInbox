// Shared TypeScript types used across backend

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar: string | null;
  slack_access_token: string | null;
  slack_channel_id: string | null;
  created_at: Date;
}

export interface Sender {
  id: string;
  user_id: string;
  email: string;       // Ethereal email address
  name: string;
  smtp_user: string;   // Ethereal SMTP username
  smtp_pass: string;   // Ethereal SMTP password
  created_at: Date;
}

export interface EmailJob {
  id: string;           // UUID - used as BullMQ job ID for idempotency
  user_id: string;
  sender_id: string;
  sender_email: string;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'delayed';
  bullmq_job_id: string | null;
  sent_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

export interface ScheduleEmailRequest {
  sender_id: string;
  recipients: string[];  // list of email addresses from CSV
  subject: string;
  body: string;
  scheduled_at: string;  // ISO datetime string
  delay_between_emails: number;  // seconds between individual sends
  hourly_limit: number;          // max per hour for this batch
}

export interface EmailJobData {
  email_job_id: string;   // DB record ID - used for idempotency
  sender_id: string;
  sender_email: string;
  smtp_user: string;
  smtp_pass: string;
  to_email: string;
  subject: string;
  body: string;
  user_id: string;
  hourly_limit?: number;
}
