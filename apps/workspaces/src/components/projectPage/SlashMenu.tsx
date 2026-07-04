'use client';

// The block-insert menu, in two flavours:
//  - SlashMenuPanel: presentational popover driven by EditableRichText's "/"
//    trigger (query typed inline, keyboard handled by the host).
//  - InsertBlockMenu: self-contained variant for "+" buttons — has its own
//    search input and keyboard handling.
// Both are portaled to <body> and positioned fixed at the trigger point.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import {
  buildSlashMenuItems, filterSlashMenuItems, type SlashMenuItem,
} from '@/lib/projectPage/slashMenu';
import type { PageBlockGroup } from '@/lib/projectPage/blocks';
import { PageBlockIcon } from './icon';

export interface MenuPosition {
  left: number;
  top: number;
  /** When true, the panel grows upward from `top` (trigger near viewport bottom). */
  openUp: boolean;
}

const GROUP_LABEL: Record<PageBlockGroup, string> = { content: 'Content', widget: 'Widgets', soon: 'Coming soon' };

export function SlashMenuPanel({
  position, items, activeIndex, onHover, onSelect,
}: {
  position: MenuPosition;
  items: SlashMenuItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: SlashMenuItem) => void;
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
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No matching blocks.</p>
        ) : (
          items.map((item, i) => {
            const groupStart = i === 0 || items[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {groupStart && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {GROUP_LABEL[item.group]}
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
                    <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{item.title}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{item.description}</span>
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

/** Self-contained insert menu for "+" buttons: own search input + keyboard nav. */
export function InsertBlockMenu({
  anchor, onSelect, onClose,
}: {
  anchor: { x: number; y: number };
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = filterSlashMenuItems(buildSlashMenuItems(), query);

  const openUp = anchor.y + 380 > (typeof window !== 'undefined' ? window.innerHeight : 9999);
  const left = Math.min(anchor.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 300);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        style={{ left, top: openUp ? anchor.y - 6 : anchor.y + 6, transform: openUp ? 'translateY(-100%)' : undefined }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-slate-800">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % Math.max(items.length, 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (items[activeIndex]) onSelect(items[activeIndex]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Search blocks…"
            className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">No matching blocks.</p>
          ) : (
            items.map((item, i) => {
              const groupStart = i === 0 || items[i - 1].group !== item.group;
              return (
                <div key={item.id}>
                  {groupStart && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {GROUP_LABEL[item.group]}
                    </p>
                  )}
                  <button
                    data-index={i}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => onSelect(item)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left ${
                      i === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <span className="h-8 w-8 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-slate-800">
                      <PageBlockIcon name={item.icon} className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{item.title}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{item.description}</span>
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
