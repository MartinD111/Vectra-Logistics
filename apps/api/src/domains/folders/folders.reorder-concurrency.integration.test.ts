import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { db } from '../../core/db';
import { raceLockedTransactions } from '../../core/testUtils/concurrentRace';
import { foldersRepository } from './folders.repository';

// ── Fixture scaffolding ─────────────────────────────────────────────────────
// Dedicated before/after fixture, isolated from folders.integration.test.ts:
// one throwaway company_id with one parent folder that has exactly 3 child
// folders as the sibling set to race two concurrent reorder transactions
// against — proving VALIDATION.md's Wave 0 lock-safety gap is closed with a
// live two-PoolClient test, not just code inspection (T-32-04-02).

const companyId = randomUUID();
let parentFolderId: string;
let childId1: string;
let childId2: string;
let childId3: string;

before(async () => {
  await db.query(`INSERT INTO companies (id, name) VALUES ($1, 'Reorder Concurrency Test Co')`, [companyId]);

  const { rows: parentRows } = await db.query(
    `INSERT INTO folders (company_id, name) VALUES ($1, 'Reorder Parent') RETURNING *`,
    [companyId],
  );
  parentFolderId = parentRows[0].id;

  const { rows: childRows } = await db.query(
    `INSERT INTO folders (company_id, parent_id, name)
     VALUES ($1, $2, 'Child 1'), ($1, $2, 'Child 2'), ($1, $2, 'Child 3')
     RETURNING *`,
    [companyId, parentFolderId],
  );
  childId1 = childRows[0].id;
  childId2 = childRows[1].id;
  childId3 = childRows[2].id;
});

after(async () => {
  await db.query(`DELETE FROM folders WHERE company_id = $1`, [companyId]);
  await db.query(`DELETE FROM companies WHERE id = $1`, [companyId]);
});

test('TREEAPI-02: concurrent reorderFolders transactions serialize via row lock — no lost update', async () => {
  const result = await raceLockedTransactions(
    db,
    async (clientA) => {
      await clientA.query('BEGIN');
      await foldersRepository.reorderFolders(clientA, companyId, parentFolderId, [childId2, childId3, childId1]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await clientA.query('COMMIT');
      return 'A';
    },
    async (clientB) => {
      await clientB.query('BEGIN');
      await foldersRepository.reorderFolders(clientB, companyId, parentFolderId, [childId3, childId1, childId2]);
      await clientB.query('COMMIT');
      return 'B';
    },
  );

  // B's transaction cannot complete before A's commits — proving the FOR
  // UPDATE lock on the shared sibling set actually blocked B until A released it.
  assert.ok(result.bFinishedAt >= result.aFinishedAt, 'expected B to finish at or after A (lock-serialized)');

  // Last-committed-wins: the final sort_order must exactly match txnB's
  // submitted order, not a merge/interleave of A and B's orderings.
  const { rows } = await db.query<{ id: string; sort_order: number }>(
    `SELECT id, sort_order FROM folders WHERE parent_id = $1 ORDER BY sort_order ASC`,
    [parentFolderId],
  );
  assert.deepEqual(rows.map((r) => r.id), [childId3, childId1, childId2]);
});
