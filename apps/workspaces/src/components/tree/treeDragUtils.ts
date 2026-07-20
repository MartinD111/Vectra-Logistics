// Pure, dependency-free drag-and-drop geometry utilities for the tree-based
// sidebar. Consumed unchanged by downstream Wave 2 drag-and-drop plans.

import type { TreeNode } from '@/lib/api/folders.api';

export interface FlatTreeRow {
  id: string;
  node_type: 'folder' | 'project';
  parentKey: string;
  depth: number;
}

// Flattens the visible (expanded) subset of the tree into drag-and-drop
// rows. Only `folder`/`project` node types are drag targets (D-03); folder
// children are only included when the folder is present in `expanded`.
export function flattenVisibleTree(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth = 0,
  parentKey = 'root'
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];

  for (const node of nodes) {
    if (node.node_type !== 'folder' && node.node_type !== 'project') {
      continue;
    }

    rows.push({ id: node.id, node_type: node.node_type, parentKey, depth });

    if (node.node_type === 'folder' && expanded.has(node.id)) {
      rows.push(...flattenVisibleTree(node.children, expanded, depth + 1, node.id));
    }
  }

  return rows;
}

// Computes which zone of a drop target row the pointer is currently over.
// `into` is only valid when the target is a folder and the pointer sits in
// the middle 50% of the row's height; otherwise the pointer resolves to
// `before`/`after` based on which half of the row it is in.
export function computeDropZone(
  pointerY: number,
  overRect: DOMRect,
  overIsFolder: boolean
): 'before' | 'after' | 'into' {
  const relative = (pointerY - overRect.top) / overRect.height;

  if (overIsFolder && relative > 0.25 && relative < 0.75) {
    return 'into';
  }

  return relative < 0.5 ? 'before' : 'after';
}
