'use client';

// Presentational popover driven by EditableRichText's "@" trigger. Exact
// structural/visual clone of SlashMenuPanel (see ./SlashMenu.tsx) — only the
// item shape and grouping (by MentionMenuItem.type instead of PageBlockGroup)
// differ.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MentionMenuItem } from '@/lib/projectPage/mentionMenu';
import { PageBlockIcon } from './icon';
import type { MenuPosition } from './SlashMenu';

const MENTION_GROUP_LABEL: Record<'person' | 'page' | 'date', string> = {
  person: 'People',
  page: 'Pages',
  date: 'Dates',
};

export function MentionMenuPanel({
  position, items, activeIndex, onHover, onSelect,
}: {
  position: MenuPosition;
  items: MentionMenuItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: MentionMenuItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-50 w-72 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
      style={{
        left: position.left,
        top: position.top,
        transform: position.openUp ? 'translateY(-100%)' : undefined,
      }}
      // Keep focus in the contentEditable host — otherwise blur commits/closes
      // before the click lands.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No matching people, pages, or dates.</p>
        ) : (
          items.map((item, i) => {
            const groupStart = i === 0 || items[i - 1].type !== item.type;
            return (
              <div key={item.id}>
                {groupStart && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {MENTION_GROUP_LABEL[item.type]}
                  </p>
                )}
                <button
                  data-index={i}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onSelect(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left ${
                    i === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <span className="h-8 w-8 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-slate-800">
                    <PageBlockIcon name={item.icon} className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{item.label}</span>
                    {item.subLabel && (
                      <span className="block text-[11px] text-gray-400 truncate">{item.subLabel}</span>
                    )}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}
