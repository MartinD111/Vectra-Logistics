'use client';

// Kanban board block — Phase 1 stores columns/cards in the page config itself
// (no shared data source yet; later phases rewire cards to live shipments or
// drafts). Read-only without onChange (PageView); editable on the live canvas.

import { useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { uid, type KanbanBlock as KanbanBlockType, type KanbanColumn } from '@/lib/projectPage/blocks';

export function KanbanBoardView({
  block,
  onChange,
}: {
  block: KanbanBlockType;
  onChange?: (block: KanbanBlockType) => void;
}) {
  const editable = !!onChange;
  const setColumns = (columns: KanbanColumn[]) => onChange?.({ ...block, columns });

  const addCard = (colId: string, text: string) => {
    if (!text.trim()) return;
    setColumns(block.columns.map((c) =>
      c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text: text.trim() }] } : c));
  };
  const removeCard = (colId: string, cardId: string) => {
    setColumns(block.columns.map((c) =>
      c.id === colId ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) } : c));
  };
  const moveCard = (colId: string, cardId: string, dir: -1 | 1) => {
    const from = block.columns.findIndex((c) => c.id === colId);
    const to = from + dir;
    if (to < 0 || to >= block.columns.length) return;
    const card = block.columns[from].cards.find((k) => k.id === cardId);
    if (!card) return;
    setColumns(block.columns.map((c, i) =>
      i === from ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) }
        : i === to ? { ...c, cards: [...c.cards, card] } : c));
  };

  return (
    <div className="saas-card !p-4">
      {block.title && <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">{block.title}</h3>}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {block.columns.map((col) => (
          <div key={col.id} className="w-56 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{col.title}</span>
              <span className="text-[10px] text-gray-400">{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((card) => (
                <div key={card.id} className="group/card rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 text-sm text-gray-800 dark:text-gray-200 shadow-sm">
                  <div className="flex items-start justify-between gap-1">
                    <span className="whitespace-pre-wrap break-words min-w-0">{card.text}</span>
                    {editable && (
                      <button onClick={() => removeCard(col.id, card.id)}
                        className="opacity-0 group-hover/card:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 transition-opacity"
                        title="Remove card">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {editable && (
                    <div className="flex justify-end gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity mt-1">
                      <button onClick={() => moveCard(col.id, card.id, -1)} className="text-gray-300 hover:text-gray-500" title="Move left">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveCard(col.id, card.id, 1)} className="text-gray-300 hover:text-gray-500" title="Move right">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {col.cards.length === 0 && !editable && (
                <p className="text-[11px] text-gray-400 px-1 py-2">Empty</p>
              )}
              {editable && <AddCardInput onAdd={(text) => addCard(col.id, text)} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddCardInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-1.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add card
      </button>
    );
  }
  const commit = () => {
    onAdd(text);
    setText('');
    setOpen(false);
  };
  return (
    <div className="space-y-1">
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setText(''); setOpen(false); }
        }}
        onBlur={commit}
        rows={2} placeholder="Card text…"
        className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none" />
    </div>
  );
}
