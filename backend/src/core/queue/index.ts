import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

// ── Connection config ─────────────────────────────────────────────────────────
// BullMQ requires its own IORedis-compatible connection object.
// We parse REDIS_URL so we don't maintain two separate connection strategies.

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const parsed = new URL(redisUrl);

const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port || '6379', 10),
  password: parsed.password || undefined,
  tls: parsed.protocol === 'rediss:' ? {} : undefined,
};

// ── Queue registry ────────────────────────────────────────────────────────────
// All queues are singletons keyed by name.  Callers use getQueue('matching')
// rather than constructing Queue instances directly, so we have one IORedis
// connection pool per named queue across the process lifetime.

// Exported so the BullMQ Worker in src/workers/ can share the same
// connection config without duplicating the URL-parsing logic.
export { connection as queueConnection };

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection }));
  }
  return queues.get(name)!;
}
