import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJwtSecretValue,
  validateEncryptionKeyValue,
  validateDeploymentModeValue,
  getDeploymentMode,
} from './secrets';

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

// ── DEPLOYMENT_MODE ───────────────────────────────────────────────────────

test('DEPLOYMENT_MODE unset -> invalid', () => {
  const result = validateDeploymentModeValue(undefined);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'DEPLOYMENT_MODE is unset or empty');
});

test('DEPLOYMENT_MODE empty string -> invalid', () => {
  const result = validateDeploymentModeValue('');
  assert.equal(result.valid, false);
});

test('DEPLOYMENT_MODE invalid value -> invalid with descriptive reason', () => {
  const result = validateDeploymentModeValue('production');
  assert.equal(result.valid, false);
  assert.equal(
    result.reason,
    'DEPLOYMENT_MODE must be exactly "cloud" or "on-prem", got "production"',
  );
});

test('DEPLOYMENT_MODE "cloud" -> valid', () => {
  const result = validateDeploymentModeValue('cloud');
  assert.equal(result.valid, true);
});

test('DEPLOYMENT_MODE "on-prem" -> valid', () => {
  const result = validateDeploymentModeValue('on-prem');
  assert.equal(result.valid, true);
});

test('getDeploymentMode() caches after first read — later env mutation has no effect', () => {
  process.env.DEPLOYMENT_MODE = 'cloud';
  const first = getDeploymentMode();
  process.env.DEPLOYMENT_MODE = 'on-prem';
  const second = getDeploymentMode();
  assert.equal(first, 'cloud');
  assert.equal(second, 'cloud');
});
