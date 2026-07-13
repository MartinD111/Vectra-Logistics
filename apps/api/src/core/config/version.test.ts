import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVersion, getVersion } from './version';

// ── resolveVersion() ──────────────────────────────────────────────────────

test('resolveVersion() — env value set -> returns trimmed env value', () => {
  const result = resolveVersion('3.0.0', () => {
    throw new Error('readVersionFile should not be called');
  });
  assert.equal(result, '3.0.0');
});

test('resolveVersion() — env unset, file readable -> returns trimmed file contents', () => {
  const result = resolveVersion(undefined, () => '3.0.0\n');
  assert.equal(result, '3.0.0');
});

test('resolveVersion() — env unset, file read throws -> returns "unknown"', () => {
  const result = resolveVersion(undefined, () => {
    throw new Error('ENOENT');
  });
  assert.equal(result, 'unknown');
});

test('resolveVersion() — env empty string (falsy) -> falls through to readVersionFile like undefined', () => {
  const result = resolveVersion('', () => '3.0.0\n');
  assert.equal(result, '3.0.0');
});

// ── getVersion() ──────────────────────────────────────────────────────────

test('getVersion() caches after first read — later env mutation has no effect', () => {
  process.env.VERSION = 'cached-val';
  const first = getVersion();
  process.env.VERSION = 'other-val';
  const second = getVersion();
  assert.equal(first, 'cached-val');
  assert.equal(second, 'cached-val');
});
