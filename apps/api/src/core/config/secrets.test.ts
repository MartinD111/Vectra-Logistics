import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateJwtSecretValue, validateEncryptionKeyValue } from './secrets';

// ── getJwtSecret() / validateJwtSecretValue() ────────────────────────────

test('JWT_SECRET unset -> invalid', () => {
  const result = validateJwtSecretValue(undefined);
  assert.equal(result.valid, false);
});

test('JWT_SECRET empty string -> invalid', () => {
  const result = validateJwtSecretValue('');
  assert.equal(result.valid, false);
});

test('JWT_SECRET known-bad (compose-level default) -> invalid', () => {
  const result = validateJwtSecretValue('vectra-dev-secret-key-change-in-production');
  assert.equal(result.valid, false);
});

test('JWT_SECRET known-bad (legacy 4-call-site default) -> invalid', () => {
  const result = validateJwtSecretValue('super-secret-key-for-dev');
  assert.equal(result.valid, false);
});

test('JWT_SECRET valid non-default value -> valid', () => {
  const result = validateJwtSecretValue('a-real-64-char-hex-or-any-non-denylisted-string');
  assert.equal(result.valid, true);
});

// ── validateSecretsOrExit() / validateEncryptionKeyValue() ───────────────

test('ENCRYPTION_KEY unset -> invalid', () => {
  const result = validateEncryptionKeyValue(undefined);
  assert.equal(result.valid, false);
});

test('ENCRYPTION_KEY present but not 64 chars -> invalid', () => {
  const result = validateEncryptionKeyValue('deadbeef');
  assert.equal(result.valid, false);
});

test('ENCRYPTION_KEY known-bad committed value -> invalid', () => {
  const result = validateEncryptionKeyValue(
    '204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20',
  );
  assert.equal(result.valid, false);
});

test('both JWT_SECRET and ENCRYPTION_KEY valid and non-default -> no exit, no throw', () => {
  const jwtResult = validateJwtSecretValue('a-real-64-char-hex-or-any-non-denylisted-string');
  const encResult = validateEncryptionKeyValue('a'.repeat(64));
  assert.equal(jwtResult.valid, true);
  assert.equal(encResult.valid, true);
});
