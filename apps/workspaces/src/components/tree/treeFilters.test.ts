// Smoke test for treeFilters.ts, run via `npx tsx`. No test framework
// dependency — mirrors the plain-Node assert-based smoke script pattern
// used elsewhere in this app.

import assert from 'node:assert';
import { pruneTree } from './treeFilters';
import type { TreeNode } from '../../lib/api/folders.api';

function makeNode(overrides: Partial<TreeNode>): TreeNode {
  return {
    node_type: 'folder',
    id: 'id',
    company_id: 'company',
    name: 'name',
    children: [],
    raw: {},
    ...overrides,
  };
}

// Test 1: archived leaf inside a folder -> folder itself is pruned once empty.
{
  const archivedChild = makeNode({
    node_type: 'data_collection',
    id: 'dc-1',
    raw: { archived_at: '2026-01-01T00:00:00Z' },
  });
  const folder = makeNode({
    node_type: 'folder',
    id: 'folder-1',
    children: [archivedChild],
  });

  const result = pruneTree([folder], new Set(['records']));
  assert.deepStrictEqual(result, [], 'Test 1 failed: archived leaf should cause empty folder to be pruned');
}

// Test 2: module-gated data_collection with archived_at: null, module disabled -> excluded.
{
  const node = makeNode({
    node_type: 'data_collection',
    id: 'dc-2',
    raw: { archived_at: null },
  });

  const result = pruneTree([node], new Set());
  assert.deepStrictEqual(result, [], 'Test 2 failed: module-disabled data_collection should be excluded');
}

// Test 3: folder with a surviving non-archived, module-enabled child is kept.
{
  const survivingChild = makeNode({
    node_type: 'data_collection',
    id: 'dc-3',
    raw: { archived_at: null },
  });
  const folder = makeNode({
    node_type: 'folder',
    id: 'folder-2',
    raw: { archived_at: '2026-01-01T00:00:00Z' }, // irrelevant for folder node_type
    children: [survivingChild],
  });

  const result = pruneTree([folder], new Set(['records']));
  assert.strictEqual(result.length, 1, 'Test 3 failed: folder with surviving child should be kept');
  assert.strictEqual(result[0].id, 'folder-2', 'Test 3 failed: wrong folder returned');
  assert.strictEqual(result[0].children.length, 1, 'Test 3 failed: surviving child should remain');
  assert.strictEqual(result[0].children[0].id, 'dc-3', 'Test 3 failed: wrong child returned');
}

// Test 4: project node is never module-gated, even with an empty enabledModules set.
{
  const project = makeNode({ node_type: 'project', id: 'proj-1' });

  const result = pruneTree([project], new Set());
  assert.strictEqual(result.length, 1, 'Test 4 failed: project node should never be module-gated');
  assert.strictEqual(result[0].id, 'proj-1', 'Test 4 failed: wrong project returned');
}

console.log('treeFilters.test.ts: all 4 behaviors passed');
