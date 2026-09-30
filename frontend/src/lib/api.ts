import axios from 'axios';
import { EmailJob, EmailsResponse, EmailStats, ScheduleEmailPayload, Sender, SlackStatus, User } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send session cookies
});

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  getMe: (): Promise<User> =>
    api.get('/auth/me').then((r) => r.data),

  logout: (): Promise<void> =>
    api.post('/auth/logout').then(() => undefined),

  getGoogleLoginUrl: () => `${API_BASE}/auth/google`,
};

// ── Senders ───────────────────────────────────────────────────────────────

export const sendersApi = {
  list: (): Promise<Sender[]> =>
    api.get('/api/senders').then((r) => r.data),

  create: (): Promise<Sender> =>
    api.post('/api/senders').then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/api/senders/${id}`).then(() => undefined),
};

// ── Emails ────────────────────────────────────────────────────────────────

export const emailsApi = {
  schedule: (payload: ScheduleEmailPayload) =>
    api.post('/api/emails/schedule', payload).then((r) => r.data),

  getScheduled: (page = 1, limit = 20): Promise<EmailsResponse> =>
    api.get('/api/emails/scheduled', { params: { page, limit } }).then((r) => r.data),

  getSent: (page = 1, limit = 20): Promise<EmailsResponse> =>
    api.get('/api/emails/sent', { params: { page, limit } }).then((r) => r.data),

  search: (q: string, status?: string, page = 1): Promise<{ hits: EmailJob[]; total: number }> =>
    api.get('/api/emails/search', { params: { q, status, page } }).then((r) => r.data),

  getStats: (): Promise<EmailStats> =>
    api.get('/api/emails/stats').then((r) => r.data),
};

// ── Slack ─────────────────────────────────────────────────────────────────

export const slackApi = {
  getStatus: (): Promise<SlackStatus> =>
    api.get('/slack/status').then((r) => r.data),

  getConnectUrl: () => `${API_BASE}/slack/connect`,

  disconnect: (): Promise<void> =>
    api.post('/slack/disconnect').then(() => undefined),
};

export default api;
