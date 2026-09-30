# ReachInbox — Installation Guide

Everything you need to run the project from scratch.

---

## 1. System Requirements

Install these first.

### 1. Node.js

**Version:** 20 or higher

Download: https://nodejs.org/en/download

Node.js includes npm automatically.

Verify installation:

```bash
node --version
npm --version
```

### 2. Docker Desktop

Docker Desktop is required for:

- PostgreSQL
- Redis
- Elasticsearch

Download: https://www.docker.com/products/docker-desktop

Docker Desktop includes Docker Compose.

Verify installation:

```bash
docker --version
docker compose version
```

### 3. Git

Required to clone the repository.

Download: https://git-scm.com/downloads

Verify installation:

```bash
git --version
```

---

## 2. Infrastructure Services

The project uses Docker for PostgreSQL, Redis, and Elasticsearch.

Start all services with:

```bash
docker compose up -d
```

### Services

| Service | Port | Purpose |
|---|---:|---|
| PostgreSQL 16 (Alpine) | `5432` | Primary database |
| Redis 7 (Alpine) | `6379` | BullMQ job queue, session store, rate-limit counters |
| Elasticsearch 8.15 | `9200` | Full-text email search |

### PostgreSQL

```text
Image:    postgres:16-alpine
User:     postgres
Password: postgres
Database: reachinbox
```

### Redis

```text
Image: redis:7-alpine
Mode:  AOF persistence
```

### Elasticsearch

```text
Image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
Memory: 512 MB JVM heap
Authentication: Disabled in development mode
```

Check the services:

```bash
docker compose ps
```

Wait until PostgreSQL and Redis are healthy before continuing.

---

## 3. Backend Setup

Backend location:

```text
/backend
```

Install dependencies:

```bash
cd backend
npm install
```

### Backend Runtime Dependencies

| Package | Purpose |
|---|---|
| `@bull-board/api` | BullMQ queue monitoring dashboard |
| `@bull-board/express` | Serves Bull Board through Express |
| `@elastic/elasticsearch` | Elasticsearch client |
| `axios` | HTTP client and Slack API calls |
| `bullmq` | Redis-backed job queue and scheduling |
| `connect-pg-simple` | PostgreSQL session store fallback |
| `connect-redis` | Redis session store |
| `cookie-parser` | Cookie parsing |
| `cors` | Allows frontend API requests |
| `dotenv` | Loads environment variables |
| `express` | Backend HTTP server |
| `express-session` | Authentication sessions |
| `google-auth-library` | Google OAuth |
| `ioredis` | Redis client |
| `nodemailer` | SMTP email sending and Ethereal accounts |
| `passport` | Authentication middleware |
| `passport-google-oauth20` | Google OAuth strategy |
| `pg` | PostgreSQL client |
| `redis` | Redis session client |
| `uuid` | UUID generation and BullMQ job IDs |

### Backend Development Dependencies

The project uses:

- TypeScript
- `ts-node-dev`
- TypeScript type definitions for the required packages

---

## 4. Frontend Setup

Frontend location:

```text
/frontend
```

Install dependencies:

```bash
cd frontend
npm install
```

### Frontend Runtime Dependencies

| Package | Purpose |
|---|---|
| `next` | React framework |
| `react` | UI library |
| `react-dom` | React DOM renderer |
| `axios` | Backend API requests |
| `react-hot-toast` | Notifications |
| `react-hook-form` | Form management |
| `@hookform/resolvers` | Form validation integration |
| `zod` | Schema validation |
| `date-fns` | Date formatting |
| `lucide-react` | UI icons |
| `next-auth` | Installed but not actively used |

The frontend also uses TypeScript, Tailwind CSS, PostCSS, ESLint, and related development dependencies.

---

## 5. External Services

### 5.1 Google OAuth

Google OAuth is required for login.

Go to:

https://console.cloud.google.com/

Create an OAuth 2.0 Client ID:

```text
Application type: Web application
```

Authorized redirect URI:

```text
http://localhost:3001/auth/google/callback
```

Add the credentials to:

```text
backend/.env
```

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

For local development, make sure the Google account you use for login is configured as a test user if the OAuth application is in testing mode.

**Do not commit real OAuth credentials to the repository.**

---

### 5.2 Ethereal Email

Ethereal is used as a fake SMTP service for testing.

**No signup is required.**

The backend automatically creates an Ethereal test account using:

```javascript
nodemailer.createTestAccount()
```

This happens when creating a new sender from the dashboard.

After sending an email, the backend logs an Ethereal preview URL.

Open that URL in a browser to inspect the sent email.

Ethereal does **not** deliver the email to the actual recipient.

Ethereal:

https://ethereal.email

---

### 5.3 Slack

Slack integration is optional and is used for rate-limit notifications.

Go to:

https://api.slack.com/apps

Create a Slack application and configure OAuth.

Required Bot Token Scopes:

```text
chat:write
im:write
```

Redirect URL:

```text
http://localhost:3001/slack/callback
```

Add the credentials to:

```text
backend/.env
```

```env
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
```

If Slack is not configured, the application will continue running and Slack notifications will be skipped.

---

## 6. Step-by-Step Installation

### Step 1 — Start Docker Services

From the project root:

```bash
docker compose up -d
```

### Step 2 — Check Infrastructure

```bash
docker compose ps
```

Wait for PostgreSQL and Redis to become healthy.

---

### Step 3 — Install Backend Dependencies

```bash
cd backend
npm install
```

---

### Step 4 — Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then edit:

```text
backend/.env
```

Set the required credentials, including:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
SESSION_SECRET=your_long_random_string
```

See the Environment Variables Reference below for the complete list.

---

### Step 5 — Run Database Migrations

```bash
npm run db:migrate
```

This creates the required database tables.

---

### Step 6 — Start the Backend

```bash
npm run dev
```

Backend:

```text
http://localhost:3001
```

BullMQ dashboard:

```text
http://localhost:3001/admin/queues
```

Keep this terminal running.

---

### Step 7 — Install Frontend Dependencies

Open a **new terminal**.

From the project root:

```bash
cd frontend
npm install
```

---

### Step 8 — Start the Frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Open the application in your browser:

http://localhost:3000

---

## 7. Ports

| Port | Service |
|---:|---|
| `3000` | Next.js frontend |
| `3001` | Express backend API |
| `5432` | PostgreSQL |
| `6379` | Redis |
| `9200` | Elasticsearch |

Make sure these ports are available before starting the application.

---

## 8. Environment Variables

### Backend

File:

```text
backend/.env
```

```env
PORT=3001
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox

REDIS_HOST=localhost
REDIS_PORT=6379

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

SESSION_SECRET=

FRONTEND_URL=http://localhost:3000

ELASTICSEARCH_URL=http://localhost:9200

WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:3001/slack/callback
```

### Required Variables

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
```

### Optional Variables

```text
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
```

### Frontend

File:

```text
frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 9. Daily Startup

After shutting down the project, use the following sequence to start it again.

### Terminal 1 — Infrastructure

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

### Terminal 2 — Backend

```bash
cd backend
npm run dev
```

### Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 10. Stopping the Project

To stop the Docker infrastructure:

```bash
docker compose down
```

This removes the containers but preserves Docker volumes used for persistent data.

**Do not use `docker compose down -v` unless you intentionally want to remove the associated Docker volumes and persistent data.**

Stop the frontend/backend development servers with:

```text
Ctrl + C
```

---

## 11. Troubleshooting

### Frontend: `ERR_CONNECTION_REFUSED`

Check that the frontend is running:

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:3000
```

### Backend API Network Error

Check that the backend is running:

```bash
cd backend
npm run dev
```

Verify:

```text
frontend/.env.local
```

contains:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Docker Services Not Running

Check:

```bash
docker compose ps
```

If required, restart:

```bash
docker compose down
docker compose up -d
```

### Port 3000 Already in Use

Another Next.js development server may already be running.

Check the existing process before starting another frontend server.

### Port 3001 Already in Use

Another backend process may already be running.

Stop the existing process before starting another backend instance.

### Google OAuth `invalid_client`

Verify:

- `GOOGLE_CLIENT_ID` is correct.
- `GOOGLE_CLIENT_SECRET` belongs to the same OAuth client.
- The OAuth client type is **Web application**.
- The redirect URI is exactly:

```text
http://localhost:3001/auth/google/callback
```

Restart the backend after changing `.env`.

---

## 12. Verification Checklist

Before considering the installation complete, verify:

- [ ] Node.js installed
- [ ] npm available
- [ ] Docker Desktop running
- [ ] Docker Compose available
- [ ] PostgreSQL container healthy
- [ ] Redis container healthy
- [ ] Elasticsearch container running
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Database migrations completed
- [ ] Google OAuth configured
- [ ] Backend starts on port `3001`
- [ ] Frontend starts on port `3000`
- [ ] Google login works
- [ ] BullMQ dashboard accessible
- [ ] Ethereal sender can be created
- [ ] Test email can be queued and processed
- [ ] Ethereal preview URL can be opened

---

## 13. Application URLs

| Purpose | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:3001 |
| BullMQ Dashboard | http://localhost:3001/admin/queues |
| Elasticsearch | http://localhost:9200 |
| Ethereal | https://ethereal.email |