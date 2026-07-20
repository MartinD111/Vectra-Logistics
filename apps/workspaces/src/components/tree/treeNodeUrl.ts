// Single source of truth for node_type -> route mapping in the tree sidebar.

import type { TreeNode } from '@/lib/api/folders.api';

export function treeNodeUrl(node: TreeNode): string | null {
  switch (node.node_type) {
    case 'project':
      return `/projects/${node.id}`;
    case 'program':
      return `/programs/${node.id}`;
    case 'project_page':
      return `/projects/${(node.raw as { project_id: string }).project_id}/pages/${node.id}`;
    case 'data_collection':
      return `/collections/${node.id}`;
    case 'folder':
      // Folders have no detail page — folder rows toggle expand/collapse only.
      return null;
    default:
      return null;
  }
}
