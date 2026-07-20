// Smoke test for treeFindPath.ts, run via `npx tsx`. No test framework
// dependency — mirrors the plain-Node assert-based smoke script pattern
// used in apps/workspaces/src/components/tree/treeFilters.test.ts.

import assert from 'node:assert';
import { findPath } from './treeFindPath';
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

// Test 1: single root node matching targetId -> returns [rootNode].
{
  const root = makeNode({ id: 'root-1' });
  const result = findPath([root], 'root-1');
  assert.deepStrictEqual(result, [root], 'Test 1 failed: single matching root should return [rootNode]');
}

// Test 2: targetId nested 3 levels deep -> returns [root, child, grandchild] in order.
{
  const grandchild = makeNode({ id: 'grandchild-1' });
  const child = makeNode({ id: 'child-1', children: [grandchild] });
  const root = makeNode({ id: 'root-2', children: [child] });

  const result = findPath([root], 'grandchild-1');
  assert.deepStrictEqual(result, [root, child, grandchild], 'Test 2 failed: nested path should return root -> child -> grandchild');
}

// Test 3: no node matches targetId -> returns null.
{
  const root = makeNode({ id: 'root-3' });
  const result = findPath([root], 'does-not-exist');
  assert.strictEqual(result, null, 'Test 3 failed: no match should return null');
}

// Test 4: empty nodes array -> returns null.
{
  const result = findPath([], 'anything');
  assert.strictEqual(result, null, 'Test 4 failed: empty nodes array should return null');
}

console.log('treeFindPath.test.ts: all 4 behaviors passed');
