'use client';

// Reusable tree row action menu (D-08): a single component that renders the
// same action list whether triggered from a per-row kebab button or a
// right-click. Cloned from ViewSettingsMenu.tsx's proven anchored-popover
// shell (fixed inset-0 backdrop + absolute/fixed positioned panel), but this
// component owns none of the trigger UI or open/close state -- the caller
// (TreeNodeRow.tsx/TreeSection.tsx, wired in Wave 2) mounts it conditionally
// and supplies the anchor mode + actions + onClose callback.

import type { LucideIcon } from 'lucide-react';

export type TreeContextMenuAnchor =
  | { type: 'button' }
  | { type: 'point'; x: number; y: number };

export interface TreeContextMenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
}

export function TreeContextMenu({
  anchor, actions, onClose,
}: {
  anchor: TreeContextMenuAnchor;
  actions: TreeContextMenuAction[];
  onClose: () => void;
}) {
  const panelPositionCls = anchor.type === 'button'
    ? 'absolute right-0 top-full mt-1 z-30'
    : 'fixed z-30';
  const panelStyle = anchor.type === 'point' ? { left: anchor.x, top: anchor.y } : undefined;

  return (
    <>
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className={`${panelPositionCls} w-48 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1`}
        style={panelStyle}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              action.onSelect();
              onClose();
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left ${
              action.destructive
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <action.icon className="w-4 h-4 flex-shrink-0" />
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}
