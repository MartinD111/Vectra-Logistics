import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  generateSecrets,
  validateAdminEmail,
  validateAdminPassword,
  validateCompanyName,
  upsertEnvVars,
  buildTagsUrl,
  probeOllamaEndpoint,
  describeProbeError,
} from './install';

// ── generateSecrets() ─────────────────────────────────────────────────────

test('generateSecrets() returns 64-char lowercase-hex jwtSecret and encryptionKey', () => {
  const { jwtSecret, encryptionKey } = generateSecrets();
  assert.match(jwtSecret, /^[0-9a-f]{64}$/);
  assert.match(encryptionKey, /^[0-9a-f]{64}$/);
});

test('generateSecrets() produces unique values across successive calls', () => {
  const first = generateSecrets();
  const second = generateSecrets();
  assert.notEqual(first.jwtSecret, second.jwtSecret);
  assert.notEqual(first.encryptionKey, second.encryptionKey);
});

// ── validateAdminEmail() ───────────────────────────────────────────────────

test('validateAdminEmail() rejects a non-email string', () => {
  const result = validateAdminEmail('not-an-email');
  assert.equal(result.valid, false);
});

test('validateAdminEmail() accepts a well-formed email', () => {
  const result = validateAdminEmail('admin@customer.com');
  assert.equal(result.valid, true);
});

// ── validateAdminPassword() ────────────────────────────────────────────────

test('validateAdminPassword() rejects passwords shorter than 8 chars', () => {
  const result = validateAdminPassword('short');
  assert.equal(result.valid, false);
});

test('validateAdminPassword() accepts a password of 8+ chars', () => {
  const result = validateAdminPassword('a-real-password-1');
  assert.equal(result.valid, true);
});

// ── validateCompanyName() ──────────────────────────────────────────────────

test('validateCompanyName() rejects an empty string', () => {
  const result = validateCompanyName('');
  assert.equal(result.valid, false);
});

test('validateCompanyName() accepts a real company name', () => {
  const result = validateCompanyName('Acme Logistics');
  assert.equal(result.valid, true);
});

// ── upsertEnvVars() ─────────────────────────────────────────────────────────

test('upsertEnvVars() creates a non-existent file containing KEY=v1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  const envPath = path.join(dir, '.env');
  try {
    upsertEnvVars(envPath, { KEY: 'v1' });
    const content = fs.readFileSync(envPath, 'utf-8');
    assert.match(content, /^KEY=v1$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upsertEnvVars() replaces an existing key in place, not duplicating it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  const envPath = path.join(dir, '.env');
  try {
    upsertEnvVars(envPath, { KEY: 'v1' });
    upsertEnvVars(envPath, { KEY: 'v2' });
    const content = fs.readFileSync(envPath, 'utf-8');
    const matches = content.match(/^KEY=/gm) ?? [];
    assert.equal(matches.length, 1);
    assert.match(content, /^KEY=v2$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upsertEnvVars() appends a new key without disturbing an existing unrelated key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  const envPath = path.join(dir, '.env');
  try {
    upsertEnvVars(envPath, { KEY: 'v1' });
    upsertEnvVars(envPath, { OTHER: 'x' });
    const content = fs.readFileSync(envPath, 'utf-8');
    assert.match(content, /^KEY=v1$/m);
    assert.match(content, /^OTHER=x$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── buildTagsUrl() ─────────────────────────────────────────────────────────

test('buildTagsUrl() strips a trailing slash before appending /api/tags', () => {
  assert.equal(buildTagsUrl('http://host:11434/'), 'http://host:11434/api/tags');
});

test('buildTagsUrl() appends /api/tags when there is no trailing slash', () => {
  assert.equal(buildTagsUrl('http://host:11434'), 'http://host:11434/api/tags');
});

// ── probeOllamaEndpoint() ────────────────────────────────────────────────────

test('probeOllamaEndpoint() resolves to false (not throw) against an unreachable port', async () => {
  const result = await probeOllamaEndpoint('http://127.0.0.1:1');
  assert.equal(result, false);
});

// ── describeProbeError() ─────────────────────────────────────────────────────

test('describeProbeError() describes ECONNREFUSED as connection refused with an Ollama hint', () => {
  const message = describeProbeError({ code: 'ECONNREFUSED' });
  assert.match(message.toLowerCase(), /connection refused/);
  assert.match(message.toLowerCase(), /is ollama running/);
});

test('describeProbeError() describes ETIMEDOUT as timed out', () => {
  const message = describeProbeError({ code: 'ETIMEDOUT' });
  assert.match(message.toLowerCase(), /timed out/);
});

test('describeProbeError() describes ENOTFOUND as a DNS resolution failure', () => {
  const message = describeProbeError({ code: 'ENOTFOUND' });
  assert.match(message.toLowerCase(), /not found|resolve/);
});

test('describeProbeError() includes the HTTP status for an axios-shaped error', () => {
  const message = describeProbeError({ isAxiosError: true, response: { status: 404 } });
  assert.match(message, /404/);
});
