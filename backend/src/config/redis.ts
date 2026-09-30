import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// BullMQ requires a specific Redis connection config
export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// General-purpose Redis client for rate limiting, sessions, etc.
const redis = new Redis(redisConnection);

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

export default redis;
