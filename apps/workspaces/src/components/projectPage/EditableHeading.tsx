'use client';

// Uncontrolled contentEditable heading editor. Extracted from LivePageCanvas so
// the page block registry can point the `heading` editor at it without a cycle.
// React must not manage its children (any re-render would reset the DOM
// mid-typing) — sync only while unfocused.

import { useEffect, useRef } from 'react';

export function EditableHeading({
  level, text, onChange,
}: { level: 1 | 2 | 3; text: string; onChange: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cls = level === 1 ? 'text-2xl font-black' : level === 2 ? 'text-lg font-bold' : 'text-base font-semibold';
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== text) el.textContent = text;
  }, [text]);
  return (
    <div className="relative">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`${cls} text-gray-900 dark:text-white min-h-[1.5em] rounded-lg px-2 py-0.5 -mx-2 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900`}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== text) onChange(next);
        }}
      />
      {!text && (
        <span className={`${cls} pointer-events-none absolute left-0 top-0.5 px-2 -mx-2 text-gray-300 dark:text-gray-600 select-none`}>
          Heading {level}
        </span>
      )}
    </div>
  );
}
