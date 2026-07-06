import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchClientsForRecipients } from './email.matcher';

test('domain match on non-denylisted domain', () => {
  const result = matchClientsForRecipients(
    ['ceo@acme.com'],
    [{ id: 'c1', email: 'billing@acme.com' }],
  );
  assert.deepEqual(result, ['c1']);
});

test('exact match on denylisted domain', () => {
  const result = matchClientsForRecipients(
    ['random@gmail.com'],
    [{ id: 'c1', email: 'random@gmail.com' }],
  );
  assert.deepEqual(result, ['c1']);
});

test('no match on denylisted domain without exact match', () => {
  const result = matchClientsForRecipients(
    ['other@gmail.com'],
    [{ id: 'c1', email: 'random@gmail.com' }],
  );
  assert.deepEqual(result, []);
});

test('multi-client dedup across recipients', () => {
  const result = matchClientsForRecipients(
    ['x@acme.com', 'y@beta.com'],
    [
      { id: 'c1', email: 'a@acme.com' },
      { id: 'c2', email: 'b@beta.com' },
    ],
  );
  assert.deepEqual(new Set(result), new Set(['c1', 'c2']));
  assert.equal(result.length, 2);
});

test('client with null email is never matched', () => {
  const result = matchClientsForRecipients(
    ['x@acme.com'],
    [{ id: 'c1', email: null }],
  );
  assert.deepEqual(result, []);
});

test('matching is case-insensitive', () => {
  const result = matchClientsForRecipients(
    ['CEO@ACME.COM'],
    [{ id: 'c1', email: 'billing@acme.com' }],
  );
  assert.deepEqual(result, ['c1']);
});
