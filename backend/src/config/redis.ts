import Redis, { RedisOptions } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Build Redis connection options.
 * - Production (Railway): REDIS_URL = "redis://default:pass@host:port"
 * - Local dev: REDIS_HOST + REDIS_PORT (defaults to localhost:6379)
 */
function buildRedisOptions(): RedisOptions {
  const url = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null as any, // Required by BullMQ
    };
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null as any,
  };
}

// Shared connection config used by both BullMQ and the ioredis client
export const redisConnection = buildRedisOptions();

// General-purpose Redis client (rate limiting, etc.)
const redis = new Redis(redisConnection);

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});

export default redis;
