// Pure DFS descendant counter over the client-cached full tree
// (GET /folders/tree/full). No mutation of input, no dependencies.

import type { TreeNode } from '@/lib/api/folders.api';

export interface DescendantCounts {
  folder: number;
  project: number;
  program: number;
  data_collection: number;
  project_page: number;
}

export function countDescendants(node: TreeNode): DescendantCounts {
  const counts: DescendantCounts = {
    folder: 0,
    project: 0,
    program: 0,
    data_collection: 0,
    project_page: 0,
  };

  function walk(children: TreeNode[]) {
    for (const child of children) {
      counts[child.node_type] += 1;
      walk(child.children);
    }
  }

  walk(node.children);

  return counts;
}
