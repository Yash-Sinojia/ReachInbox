import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import dotenv from 'dotenv';
import { redisConnection } from './config/redis';

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

// Trust Railway/Vercel reverse proxy so secure cookies work in production
app.set('trust proxy', 1);

// FRONTEND_URL can be a comma-separated list for multi-origin support:
// e.g. "https://reachinbox.vercel.app,http://localhost:3000"
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session with Redis store ───────────────────────────────────────────────
// Use the same connection config as ioredis/BullMQ — supports REDIS_URL
const redisUrlForSession = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL ||
  `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

const redisClient = createClient({ url: redisUrlForSession });
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
