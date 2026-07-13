'use client';

// Checklist / to-do block — items live in the page config (Phase 21, CONT-01).
// Read-only PageView mode still supports toggling `done` via an optional
// onChange (mirrors KanbanBoardView's editable = !!onChange dual-mode pattern),
// since "toggle individual items complete" is a page-level action, not just
// an edit-mode-only affordance.

import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Square, X, Plus } from 'lucide-react';
import { uid, type ChecklistBlock as ChecklistBlockType, type ChecklistItem } from '@/lib/projectPage/blocks';

export function ChecklistView({
  block,
  onChange,
}: {
  block: ChecklistBlockType;
  onChange?: (block: ChecklistBlockType) => void;
}) {
  const toggle = (id: string) => {
    onChange?.({ ...block, items: block.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)) });
  };

  return (
    <div className="space-y-1">
      {block.items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2 py-1">
          <button
            onClick={() => onChange && toggle(item.id)}
            disabled={!onChange}
            className="shrink-0 text-gray-400 hover:text-primary-600 disabled:cursor-default"
          >
            {item.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
          <span className={item.done ? 'line-through text-gray-400' : ''}>{item.text || 'To-do'}</span>
        </div>
      ))}
      {block.items.length === 0 && <p className="text-[11px] text-gray-400 px-1 py-2">Empty</p>}
    </div>
  );
}

export function ChecklistEditor({
  block,
  onUpdate,
}: {
  block: ChecklistBlockType;
  onUpdate: (b: ChecklistBlockType) => void;
}) {
  const setItems = (items: ChecklistItem[]) => onUpdate({ ...block, items });

  const toggle = (id: string) => {
    setItems(block.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };
  const removeItem = (id: string) => {
    setItems(block.items.filter((it) => it.id !== id));
  };
  const addItem = (text: string) => {
    if (!text.trim()) return;
    setItems([...block.items, { id: uid(), text: text.trim(), done: false }]);
  };
  const updateText = (id: string, text: string) => {
    setItems(block.items.map((it) => (it.id === id ? { ...it, text } : it)));
  };

  return (
    <div className="space-y-1">
      {block.items.map((item) => (
        <ChecklistRow
          key={item.id}
          item={item}
          onToggle={() => toggle(item.id)}
          onRemove={() => removeItem(item.id)}
          onTextChange={(text) => updateText(item.id, text)}
        />
      ))}
      <AddItemInput onAdd={addItem} />
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onRemove,
  onTextChange,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onRemove: () => void;
  onTextChange: (text: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== item.text) el.textContent = item.text;
  }, [item.text]);

  return (
    <div className="group flex items-center gap-2 py-1">
      <button onClick={onToggle} className="shrink-0 text-gray-400 hover:text-primary-600">
        {item.done ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </button>
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`flex-1 min-h-[1.25em] focus:outline-none ${item.done ? 'line-through text-gray-400' : ''}`}
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== item.text) onTextChange(next);
        }}
      />
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 shrink-0 transition-opacity"
        title="Remove item"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddItemInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-1.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add item
      </button>
    );
  }
  const commit = () => {
    onAdd(text);
    setText('');
    setOpen(false);
  };
  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setText(''); setOpen(false); }
      }}
      onBlur={commit}
      placeholder="To-do"
      className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
    />
  );
}
