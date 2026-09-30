// TypeScript types shared across the frontend

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface EmailJob {
  id: string;
  user_id: string;
  sender_id: string;
  sender_email: string;
  sender_name: string;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'scheduled' | 'sent' | 'failed' | 'delayed';
  bullmq_job_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface EmailsResponse {
  emails: EmailJob[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailStats {
  scheduled: string;
  sent: string;
  failed: string;
  delayed: string;
  total: string;
}

export interface ScheduleEmailPayload {
  sender_id: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduled_at: string;
  delay_between_emails: number;
  hourly_limit: number;
}

export interface SlackStatus {
  connected: boolean;
  team_id: string | null;
}
