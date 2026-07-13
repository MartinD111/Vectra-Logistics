import { test } from 'node:test';
import assert from 'node:assert/strict';

// Companion to server.trustproxy.test.ts — split into its own file since
// server.ts reads TRUST_PROXY_HOPS once at module load and node:test caches
// modules per-file, so both env-var states can't be exercised in one file.

test("trust proxy is applied from TRUST_PROXY_HOPS", async () => {
  process.env.TRUST_PROXY_HOPS = '1';
  const { app } = await import('./server');
  assert.equal(app.get('trust proxy'), 1);
});
