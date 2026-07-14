'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTeam } from '@/lib/hooks/useTeam';
import type { CollectionPropertyDef } from '@/lib/api/records.api';

// Schema-driven property editor. Switch on property.type, one input per
// CollectionPropertyDef kind (12 total, no default/unhandled branch). This
// component renders ONLY the input — the label row is the parent's (Plan 02
// PropertyPanel) responsibility.

function htmlTypeFor(type: CollectionPropertyDef['type']): string {
  if (type === 'number') return 'number';
  if (type === 'url') return 'url';
  if (type === 'email') return 'email';
  return 'text';
}

export function PropertyField({
  property, value, onCommit,
}: {
  property: CollectionPropertyDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  switch (property.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onCommit(e.target.checked)}
          className="rounded border-gray-300 text-primary-600"
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className="saas-input !py-2 text-sm mt-1"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onCommit(e.target.value)}
        />
      );

    case 'select': {
      const options = (property.options ?? []) as { id: string; label: string }[];
      return (
        <select
          className="saas-input !py-2 text-sm mt-1"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onCommit(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      );
    }

    case 'person':
      return <PersonField value={value} onCommit={onCommit} />;

    case 'multi-select': {
      const options = (property.options ?? []) as { id: string; label: string }[];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return <MultiSelectChips options={options} selected={selected} onCommit={onCommit} />;
    }

    case 'files':
    case 'relation': {
      const entries = Array.isArray(value) ? (value as string[]) : [];
      return <StringArrayChips entries={entries} onCommit={onCommit} />;
    }

    case 'text':
    case 'url':
    case 'email':
    case 'phone':
    case 'number':
      return (
        <DebouncedTextField
          property={property}
          value={value}
          onCommit={onCommit}
        />
      );

    default:
      return null;
  }
}

// ── person: dropdown-popover cloned from EmployeeOverrideField ─────────────

function PersonField({ value, onCommit }: { value: unknown; onCommit: (value: unknown) => void }) {
  const { data: team = [] } = useTeam();
  const [editing, setEditing] = useState(false);
  const selectedId = typeof value === 'string' ? value : '';
  const selected = selectedId ? team.find((m) => m.id === selectedId) : null;
  const label = selected ? `${selected.first_name} ${selected.last_name}`.trim() : 'Unassigned';

  const pick = (id: string) => {
    onCommit(id);
    setEditing(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setEditing((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left min-h-[32px] saas-input !py-2 text-sm mt-1"
      >
        <span className={`text-sm truncate ${selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 italic'}`}>{label}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {editing && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setEditing(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5">
            <button
              type="button"
              onClick={() => pick('')}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-gray-400 italic hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Unassigned
            </button>
            {team.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pick(m.id)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                {m.first_name} {m.last_name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── multi-select: fixed-option chip toggle (D-02, no analog found) ─────────

function MultiSelectChips({
  options, selected, onCommit,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onCommit: (value: unknown) => void;
}) {
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onCommit(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {options.map((o) => {
        const isSelected = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`rounded-full text-xs font-semibold px-3 py-1 ${
              isSelected
                ? 'bg-primary-600 text-white'
                : 'border border-gray-300 text-gray-600 dark:border-slate-600 dark:text-gray-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── files/relation: freeform tag-input (distinct from MultiSelectChips —
// no predefined property.options list, values are user-entered strings) ────

function StringArrayChips({
  entries, onCommit,
}: {
  entries: string[];
  onCommit: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCommit([...entries, trimmed]);
    setDraft('');
  };

  const remove = (entry: string) => {
    onCommit(entries.filter((e) => e !== entry));
  };

  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {entries.map((entry) => (
          <span
            key={entry}
            className="rounded-full text-xs font-semibold px-3 py-1 bg-primary-600 text-white flex items-center gap-1"
          >
            {entry}
            <button type="button" onClick={() => remove(entry)} className="hover:opacity-70" aria-label={`Remove ${entry}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="saas-input !py-2 text-sm"
        value={draft}
        placeholder="Add and press Enter…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

// ── text/url/email/phone/number: debounce-while-typing + commit-on-blur,
// cloned from InlineTextField's handleChange/flush structure ───────────────

function DebouncedTextField({
  property, value, onCommit,
}: {
  property: CollectionPropertyDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  const initial = value == null ? '' : String(value);
  const [draft, setDraft] = useState(initial);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(initial);

  useEffect(() => {
    const next = value == null ? '' : String(value);
    setDraft(next);
    lastCommittedRef.current = next;
  }, [value]);

  const flush = (next: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (next === lastCommittedRef.current) return;
    lastCommittedRef.current = next;
    if (property.type === 'number') {
      onCommit(next === '' ? null : Number(next));
    } else {
      onCommit(next);
    }
  };

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => flush(next), 800);
  };

  return (
    <input
      type={htmlTypeFor(property.type)}
      className="saas-input !py-2 text-sm mt-1"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => flush(draft)}
    />
  );
}
