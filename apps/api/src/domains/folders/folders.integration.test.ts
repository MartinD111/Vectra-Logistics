import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../../core/db';
import { RequestContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';

// ── Fixture scaffolding ─────────────────────────────────────────────────────
// This suite talks to the real dev Postgres (same `db` pool every repository
// uses) to prove constraints/triggers that a mocked-repository unit test
// cannot: composite tenant FKs (HIER-02), the cycle/depth trigger (HIER-03),
// and the full multi-table cascade-archive transaction (HIER-04). All rows
// are scoped to dedicated throwaway company_ids and fully cleaned up in
// `after`, per the threat model's T-31-05 mitigation.

const company1Id = randomUUID();
const company2Id = randomUUID();
const company3Id = randomUUID();
const testCompanyIds = [company1Id, company2Id, company3Id];
const adminUserId = randomUUID();

let folderA: { id: string };
let folderB: { id: string };

function adminCtx(companyId: string): RequestContext {
  return {
    user: {
      id: adminUserId,
      role: 'admin',
      company_id: companyId,
      is_verified: true,
    },
    companyId,
    roles: ['admin'],
    workspaceId: companyId,
    requestId: 'integration-test',
    deploymentMode: 'cloud',
    deploymentCapabilities: {
      mode: 'cloud',
      allowsLocalAiProxy: false,
      allowsSelfSignup: true,
      allowsExplicitFallbacks: true,
      requiresTrustedPublicEdges: true,
    },
  };
}

before(async () => {
  await db.query(
    `INSERT INTO companies (id, name) VALUES ($1, 'Integration Test Co 1'), ($2, 'Integration Test Co 2'), ($3, 'Integration Test Co 3')`,
    [company1Id, company2Id, company3Id],
  );

  await db.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, company_id, is_verified)
     VALUES ($1, $2, 'x', 'Integration', 'Tester', 'shipper', $3, TRUE)`,
    [adminUserId, `integration-tester-${adminUserId}@example.test`, company1Id],
  );

  const { rows: aRows } = await db.query(
    `INSERT INTO folders (company_id, name) VALUES ($1, 'Folder A') RETURNING *`,
    [company1Id],
  );
  folderA = aRows[0];

  const { rows: bRows } = await db.query(
    `INSERT INTO folders (company_id, name) VALUES ($1, 'Folder B') RETURNING *`,
    [company2Id],
  );
  folderB = bRows[0];
});

after(async () => {
  await db.query(`DELETE FROM event_outbox WHERE tenant_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM data_collections WHERE company_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM project_pages WHERE company_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM programs WHERE company_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM projects WHERE company_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM folders WHERE company_id = ANY($1::uuid[])`, [testCompanyIds]);
  await db.query(`DELETE FROM users WHERE id = $1`, [adminUserId]);
  await db.query(`DELETE FROM companies WHERE id = ANY($1::uuid[])`, [testCompanyIds]);
});

// ── Task 1: cross-tenant reparent + cycle/depth rejection ──────────────────

test('HIER-02: reparenting a folder into a different tenant\'s folder is rejected by the composite FK', async () => {
  await assert.rejects(
    () => db.query(`UPDATE folders SET parent_id = $1 WHERE id = $2`, [folderA.id, folderB.id]),
    (error: unknown) => (error as { code?: string }).code === '23503',
  );
});

test('HIER-03: moving a folder into its own descendant is rejected by the cycle trigger', async () => {
  const { rows: cRows } = await db.query(
    `INSERT INTO folders (company_id, parent_id, name, ancestor_ids) VALUES ($1, $2, 'Folder C', $3) RETURNING *`,
    [company1Id, folderA.id, [folderA.id]],
  );
  const folderC = cRows[0];

  await assert.rejects(
    () => db.query(`UPDATE folders SET parent_id = $1 WHERE id = $2`, [folderC.id, folderA.id]),
    (error: unknown) => typeof (error as { message?: string }).message === 'string'
      && (error as { message: string }).message.includes('descendant'),
  );
});

test('HIER-03: nesting a folder deeper than 3 levels is rejected by the depth trigger', async () => {
  const { rows: cRows } = await db.query(
    `INSERT INTO folders (company_id, parent_id, name, ancestor_ids) VALUES ($1, $2, 'Depth Folder C', $3) RETURNING *`,
    [company1Id, folderA.id, [folderA.id]],
  );
  const folderC = cRows[0];

  const { rows: dRows } = await db.query(
    `INSERT INTO folders (company_id, parent_id, name, ancestor_ids) VALUES ($1, $2, 'Depth Folder D', $3) RETURNING *`,
    [company1Id, folderC.id, [folderA.id, folderC.id]],
  );
  const folderD = dRows[0];

  await assert.rejects(
    () => db.query(
      `INSERT INTO folders (company_id, parent_id, name, ancestor_ids) VALUES ($1, $2, 'Too Deep', $3)`,
      [company1Id, folderD.id, [folderA.id, folderC.id, folderD.id]],
    ),
    (error: unknown) => typeof (error as { message?: string }).message === 'string'
      && (error as { message: string }).message.includes('depth'),
  );
});

// ── Task 2: cascade-archive transaction + HIER-06 static grep gate ─────────

test('HIER-04: archiving a folder cascades to its project, programs, page, and collection in one transaction', async () => {
  const { rows: folderRows } = await db.query(
    `INSERT INTO folders (company_id, name) VALUES ($1, 'Folder E') RETURNING *`,
    [company3Id],
  );
  const folderE = folderRows[0];

  const { rows: projectRows } = await db.query(
    `INSERT INTO projects (company_id, folder_id, name) VALUES ($1, $2, 'Project P') RETURNING *`,
    [company3Id, folderE.id],
  );
  const projectP = projectRows[0];

  const { rows: programRows } = await db.query(
    `INSERT INTO programs (company_id, project_id, name) VALUES ($1, $2, 'Program via project') RETURNING *`,
    [company3Id, projectP.id],
  );
  const program = programRows[0];

  const { rows: pageRows } = await db.query(
    `INSERT INTO project_pages (company_id, project_id, title) VALUES ($1, $2, 'Page') RETURNING *`,
    [company3Id, projectP.id],
  );
  const page = pageRows[0];

  const { rows: collectionRows } = await db.query(
    `INSERT INTO data_collections (company_id, project_id, name) VALUES ($1, $2, 'Collection') RETURNING *`,
    [company3Id, projectP.id],
  );
  const collection = collectionRows[0];

  await foldersService.archiveFolder(adminCtx(company3Id), folderE.id);

  const { rows: archivedFolder } = await db.query(`SELECT archived_at FROM folders WHERE id = $1`, [folderE.id]);
  const { rows: archivedProject } = await db.query(`SELECT archived_at FROM projects WHERE id = $1`, [projectP.id]);
  const { rows: archivedProgram } = await db.query(`SELECT archived_at FROM programs WHERE id = $1`, [program.id]);
  const { rows: archivedPage } = await db.query(`SELECT archived_at FROM project_pages WHERE id = $1`, [page.id]);
  const { rows: archivedCollection } = await db.query(`SELECT archived_at FROM data_collections WHERE id = $1`, [collection.id]);

  assert.notEqual(archivedFolder[0]?.archived_at, null);
  assert.notEqual(archivedProject[0]?.archived_at, null);
  assert.notEqual(archivedProgram[0]?.archived_at, null);
  assert.notEqual(archivedPage[0]?.archived_at, null);
  assert.notEqual(archivedCollection[0]?.archived_at, null);

  const expectedEvents = [
    { object_id: folderE.id, event_name: 'folder.archived' },
    { object_id: projectP.id, event_name: 'project.archived' },
    { object_id: program.id, event_name: 'program.archived' },
    { object_id: page.id, event_name: 'project_page.archived' },
    { object_id: collection.id, event_name: 'data_collection.archived' },
  ];

  const { rows: outboxRows } = await db.query<{ event_name: string; object_id: string }>(
    `SELECT event_name, object_id FROM event_outbox WHERE tenant_id = $1 AND object_id = ANY($2::uuid[])`,
    [company3Id, [folderE.id, projectP.id, program.id, page.id, collection.id]],
  );

  assert.equal(outboxRows.length, expectedEvents.length);
  for (const expected of expectedEvents) {
    const match = outboxRows.find((row) => row.object_id === expected.object_id);
    assert.ok(match, `expected an event_outbox row for object_id ${expected.object_id}`);
    assert.equal(match!.event_name, expected.event_name);
  }
});

// ── Task 2: aggregated tree read (TREEAPI-01) cross-tenant isolation ───────

test('TREEAPI-01: getFullTree returns company1\'s tree and never leaks company2/company3 fixture ids', async () => {
  const { rows: projectRows } = await db.query(
    `INSERT INTO projects (company_id, folder_id, name) VALUES ($1, $2, 'Tree Project') RETURNING *`,
    [company1Id, folderA.id],
  );
  const treeProject = projectRows[0];

  const tree = await foldersService.getFullTree(adminCtx(company1Id));

  const flatten = (nodes: typeof tree): typeof tree => nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const allNodes = flatten(tree);
  const allIds = new Set(allNodes.map((n) => n.id));

  const folderANode = allNodes.find((n) => n.node_type === 'folder' && n.id === folderA.id);
  assert.ok(folderANode, 'expected folderA in the company1 tree');
  assert.ok(allIds.has(treeProject.id), 'expected the company1-scoped project in the tree');

  // Cross-tenant isolation: folderB belongs to company2 and must never appear.
  assert.equal(allIds.has(folderB.id), false);

  await db.query(`DELETE FROM projects WHERE id = $1`, [treeProject.id]);
});

test('HIER-06: no recordEvent/activityLog reference remains anywhere in the folders domain', () => {
  const domainDir = path.join(__dirname);
  const offenders: string[] = [];

  for (const file of fs.readdirSync(domainDir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
    const contents = fs.readFileSync(path.join(domainDir, file), 'utf8');
    if (contents.includes('recordEvent') || contents.includes('activityLog')) {
      offenders.push(file);
    }
  }

  assert.equal(offenders.length, 0, `recordEvent/activityLog must not appear in the folders domain, found in: ${offenders.join(', ')}`);
});
