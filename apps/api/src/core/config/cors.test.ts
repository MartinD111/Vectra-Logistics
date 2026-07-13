import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedOrigins } from './cors';

function clearEnv(): void {
  delete process.env.CORS_ALLOWED_ORIGINS;
  delete process.env.NEXT_PUBLIC_MARKETPLACE_URL;
  delete process.env.NEXT_PUBLIC_WORKSPACES_URL;
  delete process.env.NEXT_PUBLIC_CMR_URL;
}

test('CORS_ALLOWED_ORIGINS set -> returns trimmed, comma-split list', () => {
  clearEnv();
  process.env.CORS_ALLOWED_ORIGINS = 'https://a.example, https://b.example';
  const result = getAllowedOrigins();
  assert.deepEqual(result, ['https://a.example', 'https://b.example']);
});

test('CORS_ALLOWED_ORIGINS unset, all NEXT_PUBLIC_*_URL set -> returns those 3 in order', () => {
  clearEnv();
  process.env.NEXT_PUBLIC_MARKETPLACE_URL = 'https://marketplace.example';
  process.env.NEXT_PUBLIC_WORKSPACES_URL = 'https://workspaces.example';
  process.env.NEXT_PUBLIC_CMR_URL = 'https://cmr.example';
  const result = getAllowedOrigins();
  assert.deepEqual(result, [
    'https://marketplace.example',
    'https://workspaces.example',
    'https://cmr.example',
  ]);
});

test('CORS_ALLOWED_ORIGINS unset, NEXT_PUBLIC_*_URL all unset -> returns []', () => {
  clearEnv();
  const result = getAllowedOrigins();
  assert.deepEqual(result, []);
});

test('CORS_ALLOWED_ORIGINS empty/whitespace-only -> falls back to NEXT_PUBLIC_*_URL behavior', () => {
  clearEnv();
  process.env.CORS_ALLOWED_ORIGINS = '   ';
  process.env.NEXT_PUBLIC_WORKSPACES_URL = 'https://workspaces.example';
  const result = getAllowedOrigins();
  assert.deepEqual(result, ['https://workspaces.example']);
});
