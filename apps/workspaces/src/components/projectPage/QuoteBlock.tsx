'use client';

import { useEffect, useRef } from 'react';
import type { QuoteBlock } from '@/lib/projectPage/blocks';

// Direct clone of CalloutBlock.tsx's shape but neutral-toned — no background,
// no icon — per UI-SPEC: "quote reads as understated, callout stays the only
// colored-background block".
const CONTAINER_CLASS =
  'border-l-4 border-gray-300 dark:border-slate-600 pl-3 py-1 italic text-gray-700 dark:text-gray-300';

export function QuoteView({ block }: { block: QuoteBlock }) {
  return (
    <div className={CONTAINER_CLASS}>
      <span>{block.text || 'Empty quote'}</span>
    </div>
  );
}

export function QuoteEditor({ block, onUpdate }: { block: QuoteBlock; onUpdate: (b: QuoteBlock) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== block.text) el.textContent = block.text;
  }, [block.text]);

  return (
    <div className={CONTAINER_CLASS}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[1.25em] focus:outline-none"
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== block.text) onUpdate({ ...block, text: next });
        }}
      />
    </div>
  );
}
