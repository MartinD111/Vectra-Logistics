import { test } from 'node:test';
import assert from 'node:assert/strict';

// Regression test for CR-01 (phase 20 code review): express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR whenever an X-Forwarded-For header is
// present but Express's 'trust proxy' setting is unconfigured — exactly the
// topology docs/DEPLOYMENT.md's "Recommended posture" tells operators to run.
// This asserts server.ts actually applies TRUST_PROXY_HOPS to the app, since
// an HTTP-level assertion can't distinguish this failure mode from the
// generic 500 the auth controllers already return when no database is
// reachable in a test environment.

test("trust proxy is left unset (fail closed) when TRUST_PROXY_HOPS is unset", async () => {
  delete process.env.TRUST_PROXY_HOPS;
  const { app } = await import('./server');
  assert.equal(app.get('trust proxy'), false);
});
