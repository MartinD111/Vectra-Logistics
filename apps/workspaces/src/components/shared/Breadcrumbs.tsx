'use client';

// Reusable, tree-driven breadcrumb trail. Derives a node's ancestor chain by
// walking the already-cached `useFullTree()` result client-side (D-08 — no
// new backend endpoint) and renders each ancestor as a clickable link via the
// existing ID-keyed treeNodeUrl() route mapping (D-05), with the current
// node as trailing non-link text.

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useFullTree } from '@/lib/hooks/useFolders';
import { findPath } from './treeFindPath';
import { treeNodeUrl } from '@/components/tree/treeNodeUrl';
import type { TreeNode } from '@/lib/api/folders.api';

interface BreadcrumbsProps {
  nodeType: TreeNode['node_type'];
  id: string;
  trailingLabel?: string;
}

export default function Breadcrumbs({ id, trailingLabel }: BreadcrumbsProps) {
  const { data: tree } = useFullTree();

  if (!tree) {
    return null;
  }

  const path = findPath(tree, id);

  if (!path) {
    return null;
  }

  const ancestors = path.slice(0, -1);
  const current = path[path.length - 1];

  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
      {ancestors.map((node) => (
        <span key={node.id} className="flex items-center gap-1.5">
          <Link
            href={treeNodeUrl(node) ?? '#'}
            className="hover:text-primary-600 dark:hover:text-primary-400"
          >
            {node.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
        </span>
      ))}
      <span className="font-semibold text-gray-900 dark:text-white">
        {trailingLabel ?? current.name}
      </span>
    </nav>
  );
}
