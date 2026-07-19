import type { Pool, PoolClient } from 'pg';

export interface RaceResult<A, B> {
  resultA: A;
  resultB: B;
  aFinishedAt: number;
  bFinishedAt: number;
  bStartedAt: number;
}

// DB-agnostic orchestration wrapper for testing genuinely-concurrent
// transactions (e.g. two `SELECT ... FOR UPDATE` transactions racing for the
// same lock). Contains no SQL — the BEGIN / SELECT ... FOR UPDATE /
// hold-delay / COMMIT sequencing is entirely the caller's responsibility
// inside txnA/txnB.
//
// Both PoolClients are checked out via pool.connect() BEFORE either callback
// is invoked, so pool exhaustion on a small pool can never cause one
// transaction to block waiting for a connection the other is holding
// (which would look like lock contention but isn't).
export async function raceLockedTransactions<A, B>(
  pool: Pool | { connect: () => Promise<PoolClient> },
  txnA: (client: PoolClient) => Promise<A>,
  txnB: (client: PoolClient) => Promise<B>,
): Promise<RaceResult<A, B>> {
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    let aFinishedAt = 0;
    let bFinishedAt = 0;

    const bStartedAt = Date.now();

    const [resultA, resultB] = await Promise.all([
      txnA(clientA).then((value) => {
        aFinishedAt = Date.now();
        return value;
      }),
      txnB(clientB).then((value) => {
        bFinishedAt = Date.now();
        return value;
      }),
    ]);

    return { resultA, resultB, aFinishedAt, bFinishedAt, bStartedAt };
  } finally {
    clientA.release();
    clientB.release();
  }
}
