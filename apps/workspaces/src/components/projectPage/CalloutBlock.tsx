'use client';

import { useEffect, useRef } from 'react';
import { MessagesSquare } from 'lucide-react';
import type { CalloutBlock } from '@/lib/projectPage/blocks';

const CONTAINER_CLASS =
  'flex items-start gap-2 rounded-xl border px-3 py-3 text-sm bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-300';

export function CalloutView({ block }: { block: CalloutBlock }) {
  return (
    <div className={CONTAINER_CLASS}>
      <MessagesSquare className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{block.text || 'Empty callout'}</span>
    </div>
  );
}

export function CalloutEditor({ block, onUpdate }: { block: CalloutBlock; onUpdate: (b: CalloutBlock) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== block.text) el.textContent = block.text;
  }, [block.text]);

  return (
    <div className={CONTAINER_CLASS}>
      <MessagesSquare className="w-4 h-4 mt-0.5 shrink-0" />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 min-h-[1.25em] focus:outline-none"
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== block.text) onUpdate({ ...block, text: next });
        }}
      />
    </div>
  );
}
