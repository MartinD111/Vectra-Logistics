'use client';

// Simple inline table block — a distinct block kind from any future
// collection-view table (Phase 22+). Rows/columns are edited in place;
// rows[0] is always treated as the header row.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { TableBlock } from '@/lib/projectPage/blocks';

const CONTAINER_CLASS =
  'border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden';
const HEADER_ROW_CLASS =
  'bg-gray-50 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-gray-400';
const CELL_CLASS =
  'text-sm px-2.5 py-1.5 border-t border-gray-100 dark:border-slate-800';

function Cell({
  value,
  editable,
  className,
  onCommit,
}: {
  value: string;
  editable: boolean;
  className: string;
  onCommit?: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== value) el.textContent = value;
  }, [value]);

  if (!editable) {
    return <div className={className}>{value}</div>;
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`${className} focus:outline-none`}
      onBlur={() => {
        const next = (ref.current?.textContent ?? '').trim();
        if (next !== value) onCommit?.(next);
      }}
    />
  );
}

export function TableView({ block }: { block: TableBlock }) {
  if (!block.rows.length || !block.rows[0]?.length) {
    return <p className="text-xs text-gray-400 px-1 py-2">No rows yet</p>;
  }
  const [header, ...body] = block.rows;
  return (
    <div className={CONTAINER_CLASS}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={HEADER_ROW_CLASS}>
            {header.map((cell, ci) => (
              <th key={ci} className="text-left px-2.5 py-1.5 font-bold">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={CELL_CLASS}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableEditor({
  block,
  onUpdate,
}: {
  block: TableBlock;
  onUpdate: (b: TableBlock) => void;
}) {
  const setRows = (rows: string[][]) => onUpdate({ ...block, rows });

  const setCell = (r: number, c: number, next: string) => {
    setRows(block.rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? next : cell)) : row)));
  };

  const addRow = () => {
    const cols = block.rows[0]?.length ?? 1;
    setRows([...block.rows, Array.from({ length: cols }, () => '')]);
  };

  const addColumn = () => {
    setRows(block.rows.map((row) => [...row, '']));
  };

  const removeRow = (r: number) => {
    setRows(block.rows.filter((_, ri) => ri !== r));
  };

  const removeColumn = (c: number) => {
    setRows(block.rows.map((row) => row.filter((_, ci) => ci !== c)));
  };

  if (!block.rows.length || !block.rows[0]?.length) {
    return (
      <div className={CONTAINER_CLASS}>
        <p className="text-xs text-gray-400 px-2.5 py-2">No rows yet</p>
        <button
          onClick={addRow}
          className="w-full text-left px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          + Add row
        </button>
      </div>
    );
  }

  const [header, ...body] = block.rows;

  return (
    <div>
      <div className={CONTAINER_CLASS}>
        <table className="w-full border-collapse">
          <thead>
            <tr className={HEADER_ROW_CLASS}>
              {header.map((cell, ci) => (
                <th key={ci} className="group relative text-left px-0 py-0 font-bold">
                  <Cell
                    value={cell}
                    editable
                    className="px-2.5 py-1.5"
                    onCommit={(next) => setCell(0, ci, next)}
                  />
                  <button
                    onClick={() => removeColumn(ci)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    title="Remove column"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri + 1} className="group/row relative">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-0 py-0">
                    <Cell
                      value={cell}
                      editable
                      className={CELL_CLASS}
                      onCommit={(next) => setCell(ri + 1, ci, next)}
                    />
                  </td>
                ))}
                <td className="px-0 py-0 w-0">
                  <button
                    onClick={() => removeRow(ri + 1)}
                    className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-500 transition-opacity px-1"
                    title="Remove row"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-1">
        <button onClick={addRow} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          + Add row
        </button>
        <button onClick={addColumn} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          + Add column
        </button>
      </div>
    </div>
  );
}
