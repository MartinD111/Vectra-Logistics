'use client';

// The always-live page canvas: blocks are edited in place (no edit-mode
// toggle). Typing "/" in a text block opens the slash menu; each block has
// hover controls (drag handle, + insert, width, settings, delete); reordering
// uses dnd-kit with listeners on the grip handle only, so text selection inside
// contentEditable blocks is never hijacked. Read-only contexts (the project
// Dashboard tab) keep using PageView.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Settings2, Trash2 } from 'lucide-react';
import {
  SPAN_COLS, pageBlockDef, uid,
  type BlockSpan, type PageBlock, type PageConfig,
} from '@/lib/projectPage/blocks';
import { buildSlashMenuItems, isContentItem, type SlashMenuItem } from '@/lib/projectPage/slashMenu';
import { pageBlockRegistry } from '@/lib/projectPage/registry';
import { PageBlockView } from './PageBlockView';
import { PageBlockSettings } from './PageBlockSettings';
import { EditableRichText, type SlashSelectContext } from './EditableRichText';
import { InsertBlockMenu } from './SlashMenu';

const SPAN_CYCLE: Record<BlockSpan, BlockSpan> = { full: 'half', half: 'third', third: 'full' };
const SPAN_LABEL: Record<BlockSpan, string> = { full: 'Full', half: '1/2', third: '1/3' };

export default function LivePageCanvas({
  config, projectId, clientId, onChange,
}: { config: PageConfig; projectId?: string; clientId?: string; onChange: (c: PageConfig) => void }) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ anchor: { x: number; y: number }; index: number } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const slashItems = useMemo(buildSlashMenuItems, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const setBlocks = (blocks: PageBlock[]) => onChange({ ...config, blocks });
  const updateBlock = (b: PageBlock) => setBlocks(config.blocks.map((x) => (x.id === b.id ? b : x)));
  const removeBlock = (id: string) => {
    setBlocks(config.blocks.filter((b) => b.id !== id));
    if (settingsId === id) setSettingsId(null);
  };

  const insertAt = (index: number, item: SlashMenuItem) => {
    const block = item.create();
    const arr = [...config.blocks];
    arr.splice(index, 0, block);
    setBlocks(arr);
    setInsertMenu(null);
    setFocusId(block.id);
  };

  /** "/" selection inside the text block at `hostIndex` — transform in place or insert below. */
  const handleSlashSelect = (hostIndex: number, item: SlashMenuItem, ctx: SlashSelectContext) => {
    const host = config.blocks[hostIndex];
    const created = item.create();
    const arr = [...config.blocks];
    if (ctx.isEmpty && isContentItem(item)) {
      arr[hostIndex] = created; // transform: the empty text block becomes the chosen block
    } else {
      if (host.kind === 'rich-text' || host.kind === 'list') arr[hostIndex] = { ...host, html: ctx.cleanHtml };
      arr.splice(hostIndex + 1, 0, created);
    }
    setBlocks(arr);
    setFocusId(created.id);
  };

  const onDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = config.blocks.findIndex((b) => b.id === active.id);
    const to = config.blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    setBlocks(arrayMove(config.blocks, from, to));
  };

  const activeBlock = activeDragId ? config.blocks.find((b) => b.id === activeDragId) ?? null : null;

  // Empty page: a phantom text surface that materialises into real blocks.
  if (config.blocks.length === 0) {
    return (
      <PhantomFirstBlock
        onCreateText={(html) => {
          const block: PageBlock = { id: uid(), kind: 'rich-text', span: 'full', html };
          setBlocks([block]);
          setFocusId(block.id); // keep the caret when the phantom materialises mid-typing
        }}
        onSlashSelect={(item, ctx) => {
          const blocks: PageBlock[] = [];
          if (!ctx.isEmpty) blocks.push({ id: uid(), kind: 'rich-text', span: 'full', html: ctx.cleanHtml });
          const created = item.create();
          blocks.push(created);
          setBlocks(blocks);
          setFocusId(created.id);
        }}
        slashItems={slashItems}
      />
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext items={config.blocks.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-6 gap-4">
          {config.blocks.map((b, i) => (
            <SortableBlockShell
              key={b.id}
              block={b}
              projectId={projectId}
              clientId={clientId}
              shouldFocus={focusId === b.id}
              onFocused={() => setFocusId(null)}
              settingsOpen={settingsId === b.id}
              onToggleSettings={() => setSettingsId(settingsId === b.id ? null : b.id)}
              onCloseSettings={() => setSettingsId(null)}
              onOpenInsert={(anchor) => setInsertMenu({ anchor, index: i + 1 })}
              onRemove={() => removeBlock(b.id)}
              onUpdate={updateBlock}
            >
              <BlockEditor
                block={b}
                projectId={projectId}
                clientId={clientId}
                slashItems={slashItems}
                onUpdate={updateBlock}
                onSlashSelect={(item, ctx) => handleSlashSelect(i, item, ctx)}
              />
            </SortableBlockShell>
          ))}
          {/* End-of-page insert affordance */}
          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setInsertMenu({ anchor: { x: rect.left, y: rect.bottom }, index: config.blocks.length });
            }}
            className="col-span-6 flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add a block, or type &ldquo;/&rdquo; in any text block
          </button>
        </div>
      </SortableContext>
      <DragOverlay>
        {activeBlock && (
          <div className="opacity-90 rotate-1 shadow-2xl rounded-xl bg-white dark:bg-slate-900">
            <PageBlockView block={activeBlock} projectId={projectId} clientId={clientId} />
          </div>
        )}
      </DragOverlay>
      {insertMenu && (
        <InsertBlockMenu
          anchor={insertMenu.anchor}
          onSelect={(item) => insertAt(insertMenu.index, item)}
          onClose={() => setInsertMenu(null)}
        />
      )}
    </DndContext>
  );
}

// ── Block shell: sortable wrapper + hover controls ───────────────────────────

function SortableBlockShell({
  block, projectId, clientId, children, shouldFocus, onFocused, settingsOpen, onToggleSettings, onCloseSettings,
  onOpenInsert, onRemove, onUpdate,
}: {
  block: PageBlock;
  projectId?: string;
  clientId?: string;
  children: React.ReactNode;
  shouldFocus: boolean;
  onFocused: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onOpenInsert: (anchor: { x: number; y: number }) => void;
  onRemove: () => void;
  onUpdate: (b: PageBlock) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const shellRef = useRef<HTMLDivElement>(null);

  // Focus a freshly inserted/transformed text block once it mounts.
  useEffect(() => {
    if (!shouldFocus) return;
    const raf = requestAnimationFrame(() => {
      const editable = shellRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
      if (editable) {
        editable.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false); // caret at end — matters when a phantom block materialises mid-typing
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      onFocused();
    });
    return () => cancelAnimationFrame(raf);
  }, [shouldFocus, onFocused]);

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: `span ${SPAN_COLS[block.span]} / span ${SPAN_COLS[block.span]}`,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`relative group/block ${isDragging ? 'opacity-40 z-10' : ''}`}
    >
      <div ref={shellRef}>
        {/* Left gutter: drag handle + insert */}
        <div className="absolute -left-9 top-0.5 flex flex-col gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onOpenInsert({ x: rect.left, y: rect.bottom });
            }}
            className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Insert block below"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Top-right: width / settings / delete */}
        <div className="absolute -top-3 right-1 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm px-1 py-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
          <button
            onClick={() => onUpdate({ ...block, span: SPAN_CYCLE[block.span] })}
            className="px-1.5 py-0.5 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Cycle width (full → half → third)"
          >
            {SPAN_LABEL[block.span]}
          </button>
          <button
            onClick={onToggleSettings}
            className={`p-1 rounded ${settingsOpen ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            title="Block settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded text-gray-400 hover:text-red-500"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {children}

        {settingsOpen && (
          <SettingsPopover block={block} projectId={projectId} clientId={clientId} onUpdate={onUpdate} onClose={onCloseSettings} />
        )}
      </div>
    </div>
  );
}

function SettingsPopover({
  block, projectId, clientId, onUpdate, onClose,
}: { block: PageBlock; projectId?: string; clientId?: string; onUpdate: (b: PageBlock) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-6 z-30 w-72 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
          {pageBlockDef(block.kind)?.title ?? block.kind} settings
        </h3>
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Width</p>
          <div className="flex gap-1.5">
            {(['full', 'half', 'third'] as BlockSpan[]).map((s) => (
              <button key={s} onClick={() => onUpdate({ ...block, span: s })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${block.span === s ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-slate-700 text-gray-500'}`}>
                {s === 'full' ? 'Full' : s === 'half' ? 'Half' : 'Third'}
              </button>
            ))}
          </div>
        </div>
        <PageBlockSettings block={block} projectId={projectId} clientId={clientId} onChange={onUpdate} />
      </div>
    </>
  );
}

// ── Per-kind inline editors ──────────────────────────────────────────────────

function BlockEditor({
  block, projectId, clientId, slashItems, onUpdate, onSlashSelect,
}: {
  block: PageBlock;
  projectId?: string;
  clientId?: string;
  slashItems: SlashMenuItem[];
  onUpdate: (b: PageBlock) => void;
  onSlashSelect: (item: SlashMenuItem, ctx: SlashSelectContext) => void;
}) {
  // Edit-mode dispatch via the registry: kinds with an `editor` (rich-text,
  // list, heading, kanban) render it; everything else falls back to the read
  // renderer — exactly the old `default: <PageBlockView/>` behaviour.
  return <>{pageBlockRegistry.renderEditor(block, { projectId, clientId, slashItems, onSlashSelect }, onUpdate)}</>;
}

// ── Empty page ───────────────────────────────────────────────────────────────

function PhantomFirstBlock({
  onCreateText, onSlashSelect, slashItems,
}: {
  onCreateText: (html: string) => void;
  onSlashSelect: (item: SlashMenuItem, ctx: SlashSelectContext) => void;
  slashItems: SlashMenuItem[];
}) {
  return (
    <div className="py-2">
      <EditableRichText
        html=""
        onChange={(html) => { if (html.trim()) onCreateText(html); }}
        placeholder="Type '/' for commands, or just start writing…"
        slashItems={slashItems}
        onSlashSelect={onSlashSelect}
      />
    </div>
  );
}
