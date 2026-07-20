'use client';

import { usePathname } from 'next/navigation';
import { useFullTree } from '@/lib/hooks/useFolders';
import { useCurrentWorkspace } from '@/lib/hooks/useTenantWorkspace';
import { useExpandedTreeNodes } from '@/lib/hooks/useExpandedTreeNodes';
import { pruneTree } from './treeFilters';
import TreeNodeRow from './TreeNodeRow';

export default function TreeSection() {
  const { data: tree, isLoading, isError } = useFullTree();
  const { data: workspace } = useCurrentWorkspace();
  const { expanded, toggle } = useExpandedTreeNodes();
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const enabledModules = new Set(workspace?.enabled_modules ?? []);
  const pruned = tree ? pruneTree(tree, enabledModules) : [];

  if (isLoading) {
    return null;
  }

  if (isError) {
    return (
      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border">
        <p className="px-3 text-sm text-gray-400 dark:text-gray-500">Couldn&apos;t load workspace folders.</p>
      </div>
    );
  }

  if (pruned.length === 0) {
    return null;
  }

  return (
    <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border">
      <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        Workspace
      </p>
      <div className="space-y-1">
        {pruned.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            isActive={isActive}
          />
        ))}
      </div>
    </div>
  );
}
