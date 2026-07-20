// Pure DFS ancestor-path finder over the client-cached full tree
// (GET /folders/tree/full). No mutation of input, no dependencies.

import type { TreeNode } from '@/lib/api/folders.api';

export function findPath(
  nodes: TreeNode[],
  targetId: string,
  trail: TreeNode[] = []
): TreeNode[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.id === targetId) {
      return nextTrail;
    }
    const found = findPath(node.children, targetId, nextTrail);
    if (found) {
      return found;
    }
  }
  return null;
}
