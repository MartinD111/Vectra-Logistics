'use client';

// contentEditable surface for rich-text and list blocks on the live canvas,
// extracted from PageBuilder and extended with the "/" slash-command trigger.
// Deliberately no editor library (tiptap/slate) — the trigger only fires on a
// literal "/" typed at block start or after whitespace, and bails out (closing
// the menu, leaving text untouched) on any Selection/Range inconsistency.

import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { filterSlashMenuItems, type SlashMenuItem } from '@/lib/projectPage/slashMenu';
import { SlashMenuPanel, type MenuPosition } from './SlashMenu';

export interface SlashSelectContext {
  /** Block HTML after the "/query" text was removed and sanitized. */
  cleanHtml: string;
  /** True when the block has no visible text left — the host may transform it in place. */
  isEmpty: boolean;
}

interface SlashState {
  node: Text;
  /** Index of the "/" character inside `node`. */
  offset: number;
  position: MenuPosition;
}

function caretPoint(): { node: Node; offset: number; range: Range } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  return { node: range.startContainer, offset: range.startOffset, range };
}

function menuPositionFor(range: Range, fallback: HTMLElement): MenuPosition {
  let rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && rect.top === 0) rect = fallback.getBoundingClientRect();
  const openUp = rect.bottom + 340 > window.innerHeight;
  return { left: Math.min(rect.left, window.innerWidth - 320), top: openUp ? rect.top - 6 : rect.bottom + 6, openUp };
}

export function EditableRichText({
  html, onChange, placeholder, slashItems, onSlashSelect,
}: {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Providing items enables the "/" menu. */
  slashItems?: SlashMenuItem[];
  onSlashSelect?: (item: SlashMenuItem, ctx: SlashSelectContext) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pendingSlash = useRef(false);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [empty, setEmpty] = useState(() => stripText(html) === '');

  const filtered = slashItems ? filterSlashMenuItems(slashItems, query) : [];

  // Fully uncontrolled contentEditable: React renders an empty div and we own
  // its DOM. (dangerouslySetInnerHTML is unusable here — React re-applies it on
  // re-renders, wiping whatever the user typed since the last commit.) Sync the
  // DOM from the html prop only while the element is not focused.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const target = html || '<p><br></p>';
    if (el.innerHTML !== target) {
      el.innerHTML = target;
      setEmpty((el.textContent ?? '').trim() === '');
    }
  }, [html]);

  const closeMenu = useCallback(() => {
    setSlash(null);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const commit = useCallback(() => {
    const raw = ref.current ? DOMPurify.sanitize(ref.current.innerHTML) : html;
    // Don't persist the empty-state scaffold rendered for html === ''.
    const clean = raw === '<p><br></p>' ? '' : raw;
    if (clean !== html) onChange(clean);
  }, [html, onChange]);

  // Commit while typing too (debounced) — blur-only commits lose the last
  // block's text when the user types and immediately navigates/reloads.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleCommit = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commitRef.current(), 500);
  }, []);
  useEffect(() => () => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitRef.current(); // best-effort flush on unmount
    }
  }, []);

  const selectItem = useCallback((item: SlashMenuItem) => {
    const el = ref.current;
    if (!slash || !el) return;
    try {
      // Remove the "/query" trigger text.
      const caret = caretPoint();
      const end = caret && caret.node === slash.node ? caret.offset : slash.offset + 1 + query.length;
      const range = document.createRange();
      range.setStart(slash.node, slash.offset);
      range.setEnd(slash.node, Math.min(end, slash.node.length));
      range.deleteContents();
    } catch {
      // Selection went inconsistent — keep the text as-is rather than corrupt it.
    }
    const cleanHtml = DOMPurify.sanitize(el.innerHTML);
    const isEmpty = stripText(cleanHtml) === '';
    closeMenu();
    onSlashSelect?.(item, { cleanHtml, isEmpty });
  }, [slash, query, closeMenu, onSlashSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slash) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[activeIndex]) selectItem(filtered[activeIndex]);
        else closeMenu();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      return;
    }
    if (e.key === '/' && slashItems && onSlashSelect) {
      const caret = caretPoint();
      if (!caret) return;
      // Only trigger at block start or after whitespace — never inside a word.
      if (caret.node.nodeType === Node.TEXT_NODE && caret.offset > 0) {
        const prev = (caret.node.textContent ?? '')[caret.offset - 1];
        if (prev && !/[\s ]/.test(prev)) return;
      }
      pendingSlash.current = true;
    }
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    setEmpty(el.textContent?.trim() === '');
    scheduleCommit();

    if (pendingSlash.current) {
      pendingSlash.current = false;
      const caret = caretPoint();
      if (caret && caret.node.nodeType === Node.TEXT_NODE && caret.offset > 0
        && (caret.node.textContent ?? '')[caret.offset - 1] === '/') {
        setSlash({
          node: caret.node as Text,
          offset: caret.offset - 1,
          position: menuPositionFor(caret.range, el),
        });
        setQuery('');
        setActiveIndex(0);
      }
      return;
    }

    if (slash) {
      const caret = caretPoint();
      const text = slash.node.textContent ?? '';
      if (!caret || caret.node !== slash.node || caret.offset <= slash.offset || text[slash.offset] !== '/') {
        closeMenu();
        return;
      }
      const q = text.slice(slash.offset + 1, caret.offset);
      if (q.length > 24) { closeMenu(); return; }
      setQuery(q);
      setActiveIndex(0);
    }
  };

  return (
    <>
      <div className="relative">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          className="prose prose-sm dark:prose-invert max-w-none min-h-[2rem] rounded-lg px-2 py-1 -mx-2 -my-1 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onBlur={() => {
            if (commitTimer.current) clearTimeout(commitTimer.current);
            closeMenu();
            commit();
          }}
        />
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-2 top-1 -mx-2 -my-1 px-2 py-1 text-sm text-gray-400 select-none">
            {placeholder}
          </span>
        )}
      </div>
      {slash && (
        <SlashMenuPanel
          position={slash.position}
          items={filtered}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={selectItem}
        />
      )}
    </>
  );
}

function stripText(htmlStr: string): string {
  if (typeof window === 'undefined') return htmlStr;
  const div = document.createElement('div');
  div.innerHTML = htmlStr;
  return (div.textContent ?? '').trim();
}
