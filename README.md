# ReachInbox � Email Job Scheduler

> A full-stack email scheduling platform with Google OAuth, BullMQ queues, rate limiting, Elasticsearch search, and Slack notifications.

Demo link of the project - https://drive.google.com/file/d/1FEygo9kks32iGlItrL2GBIrSaBbRn6dB/view?usp=sharing

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Running the Backend](#running-the-backend)
3. [Running the Frontend](#running-the-frontend)
4. [Ethereal Email Setup](#ethereal-email-setup)
5. [Environment Variables](#environment-variables)
6. [Architecture Overview](#architecture-overview)
   - [How Scheduling Works](#how-scheduling-works)
   - [Persistence on Restart](#persistence-on-restart)
   - [Rate Limiting & Concurrency](#rate-limiting--concurrency)
7. [Features Implemented](#features-implemented)

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | = 20 | Backend & Frontend runtime |
| Docker & Docker Compose | = 24 | PostgreSQL, Redis, Elasticsearch |
| npm | = 10 | Package manager |

### 1. Start Infrastructure (Docker)

```bash
# From the project root
docker-compose up -d
```

This starts three containers:

| Container | Port | Service |
|-----------|------|---------|
| `reachinbox_postgres` | 5432 | PostgreSQL 16 |
| `reachinbox_redis` | 6379 | Redis 7 (AOF persistence) |
| `reachinbox_elasticsearch` | 9200 | Elasticsearch 8.15 |

Wait ~15 seconds for all health checks to pass:

```bash
docker-compose ps   # all should show "healthy"
```

### 2. Run Database Migrations

```bash
cd backend
npm install
npm run db:migrate
```

### 3. Start Backend

```bash
cd backend
npm run dev
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Running the Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Run database migrations (first time, or after schema changes)
npm run db:migrate

# Start dev server (TypeScript, hot-reload via ts-node-dev)
npm run dev

# Production build
npm run build
npm start
```

**Backend runs on:** `http://localhost:3001`

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /auth/google` | Start Google OAuth |
| `GET /auth/google/callback` | OAuth callback |
| `GET /auth/me` | Current session user |
| `POST /auth/logout` | Destroy session |
| `GET /api/emails/scheduled` | List scheduled emails |
| `GET /api/emails/sent` | List sent/failed emails |
| `POST /api/emails/schedule` | Schedule new email batch |
| `GET /api/emails/stats` | Dashboard stats |
| `GET /api/emails/search?q=` | Full-text search via Elasticsearch |
| `GET /api/senders` | List sender accounts |
| `POST /api/senders` | Create Ethereal sender |
| `DELETE /api/senders/:id` | Delete sender |
| `GET /slack/status` | Slack connection status |
| `GET /slack/connect` | Start Slack OAuth |
| `POST /slack/disconnect` | Disconnect Slack |
| `GET /admin/queues` | BullMQ Dashboard (Bull-Board UI) |

### Running the BullMQ Worker

The worker runs **in the same process** as the Express server (started automatically by `npm run dev`). In production you can separate it:

```bash
# Worker is started inside src/index.ts via:
createEmailWorker();
```

---

## Running the Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server (Next.js 16 with Webpack)
npm run dev

# Production build
npm run build
npm start
```

**Frontend runs on:** `http://localhost:3000`

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Google OAuth sign-in |
| Dashboard | `/dashboard` | Email tables, stats, compose |

---

## Ethereal Email Setup

[Ethereal](https://ethereal.email/) is a **fake SMTP service** for testing � emails are captured but never delivered to real inboxes. No account creation is needed; the backend generates test accounts automatically.

### How It Works

1. When you click **"New Sender"** in the dashboard, the backend calls `nodemailer.createTestAccount()` which hits the Ethereal API and returns a fresh SMTP credential pair.
2. These credentials (`smtp_user` + `smtp_pass`) are stored in the `senders` table in PostgreSQL.
3. When the worker sends an email, it authenticates to `smtp.ethereal.email:587` with those credentials.
4. After sending, the terminal logs a **preview URL** like:
   ```
   Email sent to alice@example.com | Preview: https://ethereal.email/message/abc123...
   ```
5. Open the preview URL in your browser to inspect the full sent email.

### No Extra Environment Variables Needed

Ethereal accounts are auto-generated � you do not need to set any SMTP env vars manually. The account credentials are persisted in the database per sender.

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in the required values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3001` | No | Express server port |
| `NODE_ENV` | `development` | No | Environment mode |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reachinbox` | **Yes** | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | No | Redis hostname |
| `REDIS_PORT` | `6379` | No | Redis port |
| `GOOGLE_CLIENT_ID` | � | **Yes** | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | � | **Yes** | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/auth/google/callback` | No | OAuth redirect URI |
| `SESSION_SECRET` | � | **Yes** | Random string for session signing |
| `FRONTEND_URL` | `http://localhost:3000` | No | CORS origin + OAuth redirect |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | No | Elasticsearch endpoint |
| `WORKER_CONCURRENCY` | `5` | No | Number of concurrent BullMQ workers |
| `MIN_SEND_DELAY_MS` | `2000` | No | Min ms between email sends (global throttle) |
| `MAX_EMAILS_PER_HOUR` | `200` | No | Global hourly limit across all senders |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | No | Per-sender hourly limit |
| `SLACK_CLIENT_ID` | � | No | Slack app Client ID (optional) |
| `SLACK_CLIENT_SECRET` | � | No | Slack app Client Secret (optional) |
| `SLACK_REDIRECT_URI` | `http://localhost:3001/slack/callback` | No | Slack OAuth redirect URI |

#### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project ? APIs & Services ? Credentials
3. Create **OAuth 2.0 Client ID** (Web application type)
4. Add `http://localhost:3001/auth/google/callback` to **Authorized redirect URIs**
5. Copy Client ID and Client Secret into `.env`

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                        Browser (Next.js)                         |
|  Login -> Google OAuth -> Dashboard -> Compose -> Email Tables   |
+------------------------------+-----------------------------------+
                               | HTTP (Axios, withCredentials)
                               v
+------------------------------------------------------------------+
|                   Express API (port 3001)                        |
|  /auth/*   /api/emails/*   /api/senders/*   /slack/*            |
|                                                                  |
|  Session --> Redis (connect-redis)                              |
|  ORM     --> PostgreSQL (pg pool)                               |
|  Queue   --> BullMQ -> Redis                                    |
|  Search  --> Elasticsearch                                      |
|  Dashboard > Bull-Board UI (/admin/queues)                      |
+----------+-------------------------------------------------------+
           |
           v
+------------------------------------------------------------------+
|                     BullMQ Worker                                |
|  (same process in dev, separate process in production)           |
|                                                                  |
|  1. Check rate limit (Redis INCR)                               |
|  2. Send via Ethereal SMTP (nodemailer)                         |
|  3. Update PostgreSQL + Elasticsearch                           |
|  4. Notify Slack on rate-limit hit                              |
+------------------------------------------------------------------+
```

---

### How Scheduling Works

1. **User composes an email** in the dashboard: selects a sender, enters recipients (comma-separated), subject, body, and a scheduled datetime.

2. **`POST /api/emails/schedule`** receives the request:
   - Validates sender ownership (belongs to the authenticated user)
   - For each recipient, calculates a staggered send time:
     ```
     send_time = scheduled_at + (index * delay_between_emails_seconds)
     ```
   - Creates a row in the `email_jobs` table with `status = 'scheduled'`
   - Enqueues a BullMQ job with `delay = send_time - now()` and `jobId = email_job_id` (idempotency key)
   - Indexes the job in Elasticsearch for full-text search

3. **BullMQ** stores jobs in **Redis** as delayed jobs. When the delay expires, the job moves to the active queue.

4. **The Worker** picks up the job:
   - Checks rate limit (Redis atomic `INCR`)
   - If allowed ? sends via Ethereal SMTP ? updates DB to `sent`
   - If rate-limited ? re-queues with delay to next hour boundary ? updates DB to `delayed`
   - On SMTP failure ? throws error ? BullMQ retries ? DB updated to `failed`

---

### Persistence on Restart

The system survives server restarts at every layer:

| Layer | Mechanism | What Is Persisted |
|-------|-----------|-------------------|
| **PostgreSQL** | Persistent Docker volume (`postgres_data`) | All email jobs, users, senders |
| **Redis** | AOF (Append-Only File) via `--appendonly yes` | BullMQ jobs, sessions, rate-limit counters |
| **Elasticsearch** | Persistent Docker volume (`es_data`) | Email search index |
| **BullMQ jobs** | Stored in Redis before any processing | Jobs survive backend restarts because they live in Redis, not memory |
| **Sessions** | Redis-backed via `connect-redis` | Users stay logged in across backend restarts |
| **Idempotency** | `jobId = email_job_id` (UUID) | If a job is re-enqueued after restart, BullMQ ignores duplicate `jobId` |
| **Already-sent guard** | Worker checks `status = 'sent' AND sent_at IS NOT NULL` before processing | Prevents double-sending on worker restart |

**Key invariant:** An email job that was already `sent` (with a non-null `sent_at` timestamp written only after SMTP success) will never be sent again, even if BullMQ replays the job.

---

### Rate Limiting & Concurrency

#### Per-Sender Hourly Rate Limit (Redis)

```
Key: rate_limit:{userId}:{senderEmail}:{YYYY:MM:DD:HH}
TTL: 7200s (auto-cleanup)
```

- Worker atomically `INCR`s the key before sending
- If `current > hourly_limit` => decrements (rollback) => re-queues job with delay to next hour
- Only the **first** over-limit rejection in a window sends a Slack notification (uses Redis `SET NX` to prevent spam)

#### Global Send Throttle (BullMQ Limiter)

The worker is configured with a BullMQ `limiter`:

```typescript
limiter: {
  max: 1,
  duration: MIN_SEND_DELAY_MS,  // default 2000ms
}
```

This enforces a **minimum 2-second gap** between any two email sends globally, preventing SMTP flooding regardless of concurrency.

#### Worker Concurrency

```typescript
concurrency: WORKER_CONCURRENCY  // default 5
```

Up to 5 jobs can be **processed in parallel** (rate-limit checks, DB writes, etc.), but the `limiter` ensures actual SMTP sends are serialized with at least a 2-second gap.

#### Summary

| Mechanism | Scope | Configurable via |
|-----------|-------|-----------------|
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Per sender per hour | `.env` or compose form |
| `MAX_EMAILS_PER_HOUR` | Global per hour | `.env` |
| `MIN_SEND_DELAY_MS` | Gap between sends | `.env` |
| `WORKER_CONCURRENCY` | Parallel job processors | `.env` |

---

## Features Implemented

### Backend

| Feature | File | Description |
|---------|------|-------------|
| **Google OAuth** | `src/routes/auth.ts` | Full OAuth 2.0 flow using `google-auth-library`; user upserted in DB |
| **Session Management** | `src/index.ts` | Redis-backed sessions via `connect-redis`; survive restarts |
| **Email Scheduling** | `src/routes/emails.ts` | Batch scheduling with per-recipient delay staggering |
| **BullMQ Queue** | `src/config/queue.ts` | Delayed job queue backed by Redis |
| **Email Worker** | `src/workers/emailWorker.ts` | Processes jobs: rate-check => send => update DB + ES |
| **Ethereal SMTP** | `src/services/emailService.ts` | Auto-creates test accounts; caches transporters |
| **Rate Limiting** | `src/services/rateLimitService.ts` | Atomic Redis INCR per sender per hour window |
| **Concurrency** | `src/workers/emailWorker.ts` | BullMQ `concurrency` + `limiter` options |
| **Persistence** | Docker volumes + Redis AOF | Jobs survive server/container restarts |
| **Idempotency** | `jobId = email_job_id` | Duplicate jobs are rejected by BullMQ |
| **Already-sent guard** | `src/workers/emailWorker.ts` | DB `status=sent AND sent_at IS NOT NULL` prevents re-send |
| **Elasticsearch Search** | `src/services/elasticsearchService.ts` | Full-text search on subject, body, email addresses |
| **Sender Management** | `src/routes/senders.ts` | CRUD for Ethereal sender accounts |
| **Slack Notifications** | `src/services/slackService.ts` | DM/channel alert when rate limit is hit |
| **Bull-Board Dashboard** | `src/index.ts` | Live BullMQ job monitoring UI at `/admin/queues` |
| **Database Migrations** | `src/db/migrate.ts` | Idempotent `CREATE TABLE IF NOT EXISTS` migrations |

### Frontend

| Feature | File | Description |
|---------|------|-------------|
| **Login Page** | `src/app/login/` | Google OAuth redirect button, error handling |
| **Auth Hook** | `src/hooks/useAuth.ts` | Session check on mount; auto-redirect to login |
| **Dashboard** | `src/app/dashboard/page.tsx` | Main app shell with stats, tabs, search |
| **Stats Bar** | `src/app/dashboard/page.tsx` | Live counts: Total / Scheduled / Sent / Failed / Delayed |
| **Scheduled Table** | `src/components/EmailTable.tsx` | Paginated list of pending emails |
| **Sent Table** | `src/components/EmailTable.tsx` | Paginated list of sent/failed emails |
| **Compose Modal** | `src/components/ComposeModal.tsx` | Schedule email form: sender, recipients, subject, body, datetime, delay |
| **Sender Management** | `src/app/dashboard/page.tsx` | Create & delete Ethereal senders inline |
| **Full-text Search** | `src/app/dashboard/page.tsx` | Live search via Elasticsearch endpoint |
| **Slack Integration** | `src/app/dashboard/page.tsx` | Connect/disconnect Slack from sidebar |
| **Auto-refresh** | `src/app/dashboard/page.tsx` | Polls every 15 seconds; manual refresh button |
| **Bull-Board Link** | `src/app/dashboard/page.tsx` | Direct link to `/admin/queues` in the topbar |
| **Resilient Fetching** | `src/app/dashboard/page.tsx` | `Promise.allSettled` � partial API failures don't crash the UI |
| **Toast Notifications** | Throughout | `react-hot-toast` for success/error feedback |
| **API Layer** | `src/lib/api.ts` | Typed Axios client with `withCredentials` for cookie sessions |
