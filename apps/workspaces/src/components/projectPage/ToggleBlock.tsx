'use client';

// Toggle block (CONT-02) — a collapsible section containing other blocks.
// collapsed/children are persisted via onUpdate (not local useState), so state
// survives reload. Renders arbitrary child blocks via ctx.renderChild, which
// the block registry module wires in — this component has no direct dependency
// on that module, keeping the plugin-dispatch cycle one-directional.

import { ChevronRight } from 'lucide-react';
import type { ToggleBlock as ToggleBlockType, PageBlock } from '@/lib/projectPage/blocks';
import type { SlashMenuItem } from '@/lib/projectPage/slashMenu';
import { NestedBlockList } from './NestedBlockList';

export interface PageCtxLike {
  nestableSlashItems?: SlashMenuItem[];
  renderChild: (block: PageBlock, onUpdate: (b: PageBlock) => void) => React.ReactNode;
}

function ToggleBody({
  block, ctx, onUpdate, editable,
}: {
  block: ToggleBlockType;
  ctx: PageCtxLike;
  onUpdate?: (b: ToggleBlockType) => void;
  editable: boolean;
}) {
  const toggle = () => onUpdate?.({ ...block, collapsed: !block.collapsed });
  const setTitle = (title: string) => onUpdate?.({ ...block, title });

  return (
    <div className="saas-card !p-3">
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggle}
          className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
          title={block.collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${!block.collapsed ? 'rotate-90' : ''}`} />
        </button>
        {editable ? (
          <span
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setTitle(e.currentTarget.textContent ?? '')}
            className="text-sm font-semibold text-gray-900 dark:text-white outline-none flex-1 empty:before:content-['Toggle'] empty:before:text-gray-300 dark:empty:before:text-gray-600"
          >
            {block.title}
          </span>
        ) : (
          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
            {block.title || 'Toggle'}
          </span>
        )}
      </div>
      {!block.collapsed && (
        <div className="mt-2">
          <NestedBlockList
            blocks={block.children}
            onChange={(children) => onUpdate?.({ ...block, children })}
            renderChild={ctx.renderChild}
            nestableItems={ctx.nestableSlashItems ?? []}
          />
        </div>
      )}
    </div>
  );
}

export function ToggleView({
  block, ctx, onChange,
}: {
  block: ToggleBlockType;
  ctx: PageCtxLike;
  onChange?: (b: ToggleBlockType) => void;
}) {
  return <ToggleBody block={block} ctx={ctx} onUpdate={onChange} editable={!!onChange} />;
}

export function ToggleEditor({
  block, ctx, onUpdate,
}: {
  block: ToggleBlockType;
  ctx: PageCtxLike;
  onUpdate: (b: ToggleBlockType) => void;
}) {
  return <ToggleBody block={block} ctx={ctx} onUpdate={onUpdate} editable />;
}
