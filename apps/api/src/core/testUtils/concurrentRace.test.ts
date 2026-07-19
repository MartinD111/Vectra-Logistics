import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceLockedTransactions } from './concurrentRace';

interface FakeClient {
  query: (...args: unknown[]) => unknown;
  release: () => void;
  releaseCalls: number;
}

function makeFakeClient(): FakeClient {
  const client: FakeClient = {
    query: () => undefined,
    release: () => {
      client.releaseCalls += 1;
    },
    releaseCalls: 0,
  };
  return client;
}

function makeFakePool(clients: FakeClient[]): { connect: () => Promise<FakeClient> } {
  let i = 0;
  return {
    connect: async () => {
      const client = clients[i];
      i += 1;
      return client;
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('both connect() calls happen before either txnA/txnB body starts executing', async () => {
  const callOrder: string[] = [];
  const clientA = makeFakeClient();
  const clientB = makeFakeClient();

  let connectCount = 0;
  const pool = {
    connect: async () => {
      connectCount += 1;
      callOrder.push(`connect-${connectCount}`);
      return connectCount === 1 ? clientA : clientB;
    },
  };

  await raceLockedTransactions(
    pool as any,
    async () => {
      callOrder.push('txnA-start');
      return 'A';
    },
    async () => {
      callOrder.push('txnB-start');
      return 'B';
    },
  );

  const connectIdxA = callOrder.indexOf('connect-1');
  const connectIdxB = callOrder.indexOf('connect-2');
  const txnAIdx = callOrder.indexOf('txnA-start');
  const txnBIdx = callOrder.indexOf('txnB-start');

  assert.ok(connectIdxA < txnAIdx);
  assert.ok(connectIdxA < txnBIdx);
  assert.ok(connectIdxB < txnAIdx);
  assert.ok(connectIdxB < txnBIdx);
});

test('bStartedAt is recorded before txnB resolves even when txnA is deliberately slower', async () => {
  const clientA = makeFakeClient();
  const clientB = makeFakeClient();
  const pool = makeFakePool([clientA, clientB]);

  let bResolvedAt = 0;

  const result = await raceLockedTransactions(
    pool as any,
    async () => {
      await delay(50);
      return 'A';
    },
    async () => {
      await delay(10);
      bResolvedAt = Date.now();
      return 'B';
    },
  );

  assert.ok(result.bStartedAt <= bResolvedAt);
  assert.ok(result.bFinishedAt >= bResolvedAt);
  // Proves concurrency: txnB resolved well before txnA's 50ms delay elapsed.
  assert.ok(result.bFinishedAt < result.aFinishedAt);
});

test('resultA/resultB exactly equal each callback resolved value', async () => {
  const clientA = makeFakeClient();
  const clientB = makeFakeClient();
  const pool = makeFakePool([clientA, clientB]);

  const result = await raceLockedTransactions(
    pool as any,
    async () => ({ value: 'alpha' }),
    async () => ({ value: 'beta' }),
  );

  assert.deepEqual(result.resultA, { value: 'alpha' });
  assert.deepEqual(result.resultB, { value: 'beta' });
});

test('both fake clients release() is called exactly once each, even when one callback throws', async () => {
  const clientA = makeFakeClient();
  const clientB = makeFakeClient();
  const pool = makeFakePool([clientA, clientB]);

  await assert.rejects(
    raceLockedTransactions(
      pool as any,
      async () => {
        throw new Error('txnA failed');
      },
      async () => 'B',
    ),
  );

  assert.equal(clientA.releaseCalls, 1);
  assert.equal(clientB.releaseCalls, 1);
});
