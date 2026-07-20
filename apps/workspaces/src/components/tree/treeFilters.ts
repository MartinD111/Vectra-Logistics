// Pure, dependency-free filtering utilities for the tree-based sidebar.
// Consumed unchanged by downstream Wave 2 rendering plans.

import type { TreeNode } from '@/lib/api/folders.api';

// Node types gated by an `enabledModules` set. `folder` and `project` are
// intentionally absent — per D-04, the module gate never applies to them.
const MODULE_KEY: Partial<Record<TreeNode['node_type'], string>> = {
  data_collection: 'records',
  project_page: 'records',
  program: 'programs',
};

// `folders`/`projects`/`programs` are already filtered server-side (their
// underlying queries exclude archived rows); `data_collections`/
// `project_pages` are not (D-12/RESEARCH.md verified gap), so only those two
// node types are checked here.
export function isArchived(node: TreeNode): boolean {
  if (node.node_type !== 'data_collection' && node.node_type !== 'project_page') {
    return false;
  }
  return (node.raw as { archived_at: string | null }).archived_at != null;
}

export function pruneTree(nodes: TreeNode[], enabledModules: Set<string>): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (isArchived(node)) {
      return acc;
    }

    const moduleKey = MODULE_KEY[node.node_type];
    if (moduleKey && !enabledModules.has(moduleKey)) {
      return acc;
    }

    const prunedChildren = pruneTree(node.children, enabledModules);

    if (node.node_type === 'folder' && node.children.length > 0 && prunedChildren.length === 0) {
      return acc;
    }

    acc.push({ ...node, children: prunedChildren });
    return acc;
  }, []);
}
