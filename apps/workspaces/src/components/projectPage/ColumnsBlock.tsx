'use client';

// Columns block (CONT-07) — a fixed 2-lane layout, each lane a nested mini-canvas
// (NestedBlockList), sharing the exact same nested-rendering mechanism as
// ToggleBlock.tsx's children (D-01). Has no direct dependency on the block
// registry module — arbitrary child blocks are rendered via ctx.renderChild.

import type { ColumnsBlock as ColumnsBlockType } from '@/lib/projectPage/blocks';
import type { PageCtxLike } from './ToggleBlock';
import { NestedBlockList } from './NestedBlockList';

function ColumnsBody({
  block, ctx, onUpdate,
}: {
  block: ColumnsBlockType;
  ctx: PageCtxLike;
  onUpdate?: (b: ColumnsBlockType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-gray-50/50 dark:bg-slate-800/30 rounded-lg p-2">
          <NestedBlockList
            blocks={block.columns[i]}
            onChange={(laneBlocks) =>
              onUpdate?.({ ...block, columns: block.columns.map((col, ci) => (ci === i ? laneBlocks : col)) })
            }
            renderChild={ctx.renderChild}
            nestableItems={ctx.nestableSlashItems ?? []}
          />
        </div>
      ))}
    </div>
  );
}

export function ColumnsView({
  block, ctx, onChange,
}: {
  block: ColumnsBlockType;
  ctx: PageCtxLike;
  onChange?: (b: ColumnsBlockType) => void;
}) {
  return <ColumnsBody block={block} ctx={ctx} onUpdate={onChange} />;
}

export function ColumnsEditor({
  block, ctx, onUpdate,
}: {
  block: ColumnsBlockType;
  ctx: PageCtxLike;
  onUpdate: (b: ColumnsBlockType) => void;
}) {
  return <ColumnsBody block={block} ctx={ctx} onUpdate={onUpdate} />;
}
