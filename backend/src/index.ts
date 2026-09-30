import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import dotenv from 'dotenv';

// BullBoard imports for live queue dashboard
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Routes
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import senderRoutes from './routes/senders';
import slackRoutes from './routes/slack';

// Services & config
import { emailQueue } from './config/queue';
import { initElasticsearch } from './config/elasticsearch';
import { createEmailWorker } from './workers/emailWorker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session with Redis store ───────────────────────────────────────────────
// Redis-backed sessions survive server restarts
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});
redisClient.connect().catch(console.error);

const redisStore = new RedisStore({
  client: redisClient as any,
  prefix: 'sess:',
});

app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── BullMQ Dashboard (Bull-Board) ──────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
console.log('✅ Bull-Board dashboard at /admin/queues');

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/senders', senderRoutes);
app.use('/slack', slackRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ReachInbox Email Scheduler',
  });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ───────────────────────────────────────────────────────────
async function start() {
  try {
    // Initialize Elasticsearch index
    await initElasticsearch();

    // Start the BullMQ email worker
    // Worker runs in the same process for simplicity.
    // In production, you'd run this in a separate process/container.
    createEmailWorker();

    app.listen(PORT, () => {
      console.log(`\n🚀 ReachInbox Backend running on http://localhost:${PORT}`);
      console.log(`📊 BullMQ Dashboard: http://localhost:${PORT}/admin/queues`);
      console.log(`🔑 Google OAuth: http://localhost:${PORT}/auth/google`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
