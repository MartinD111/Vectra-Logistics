'use client';

// Shared nested mini-canvas for toggle children / column lanes (Phase 21).
// Deliberately does NOT reuse LivePageCanvas.tsx's drag-sort library — a second
// sortable context nested inside the page's own top-level one risks drop-target
// collisions (RESEARCH.md Pitfall 3). Instead: an ordered list with an
// "+ Add block" insert-only affordance (reusing InsertBlockMenu, pre-filtered
// to nestable items) plus optional up/down move buttons — no drag-and-drop.

import { useState } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { PageBlock } from '@/lib/projectPage/blocks';
import type { SlashMenuItem } from '@/lib/projectPage/slashMenu';
import { InsertBlockMenu } from './SlashMenu';

function arraySwap<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function NestedBlockList({
  blocks, onChange, renderChild, nestableItems,
}: {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  renderChild: (block: PageBlock, onUpdate: (b: PageBlock) => void) => React.ReactNode;
  nestableItems: SlashMenuItem[];
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const from = blocks.findIndex((b) => b.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= blocks.length) return;
    onChange(arraySwap(blocks, from, to));
  };

  return (
    <div className="pl-5 border-l border-gray-100 dark:border-slate-800 space-y-2">
      {blocks.map((block, i) => (
        <div key={block.id} className="relative group/nested">
          <div className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 opacity-0 group-hover/nested:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded-md">
            <button
              onClick={() => move(block.id, -1)}
              disabled={i === 0}
              className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => move(block.id, 1)}
              disabled={i === blocks.length - 1}
              className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => remove(block.id)}
              className="p-0.5 text-gray-300 hover:text-red-500"
              title="Remove block"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {renderChild(block, (updated) => onChange(blocks.map((b) => (b.id === updated.id ? updated : b))))}
        </div>
      ))}
      <button
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMenuAnchor({ x: rect.left, y: rect.bottom });
        }}
        className="w-full flex items-center gap-1.5 px-1.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add block
      </button>
      {menuAnchor && (
        <InsertBlockMenu
          anchor={menuAnchor}
          items={nestableItems}
          onSelect={(item) => { onChange([...blocks, item.create()]); setMenuAnchor(null); }}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
}
