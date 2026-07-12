# Phase 12: Extensibility Proof - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 4 (1 new, 3 edited)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` (new) | component (view + inline editor pair) | request-response (client-local state, no network) | `apps/workspaces/src/components/projectPage/EditableHeading.tsx` | exact (uncontrolled contentEditable pattern) — combined with the `HeadingView`/read-mode shape already inlined in RESEARCH.md Pattern 1 |
| `apps/workspaces/src/lib/projectPage/blocks.ts` (edit) | model / registry (union + declarative metadata array) | CRUD (in-memory JSONB-serializable block object) | itself — existing `HeadingBlock` interface + `PAGE_BLOCK_REGISTRY` entries (e.g. `heading`, `divider`) | exact |
| `apps/workspaces/src/lib/projectPage/registry.tsx` (edit) | provider / registry wiring (dispatch table entry) | request-response (render/edit dispatch) | itself — existing `'heading': entry(...)` line | exact |
| `apps/workspaces/src/lib/miniProgram/plugins/examples.ts` (edit) | config/manifest (declarative plugin object) | transform (batch row transform via sandboxed `logic.source`) | itself — existing `dedupe`/`wordCount` `PluginBlockManifest` objects | exact |

No controller, service, model (DB), middleware, or SQL migration files are touched — this phase is 100% frontend, additive, no backend/API change (confirmed in RESEARCH.md: `PageConfigSchema` treats blocks as `z.unknown()`).

## Pattern Assignments

### `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` (new)

**Analog:** `apps/workspaces/src/components/projectPage/EditableHeading.tsx` (41 lines, read in full)

**Imports pattern** (lines 1-8 of analog):
```tsx
'use client';

// Uncontrolled contentEditable heading editor. Extracted from LivePageCanvas so
// the page block registry can point the `heading` editor at it without a cycle.
// React must not manage its children (any re-render would reset the DOM
// mid-typing) — sync only while unfocused.

import { useEffect, useRef } from 'react';
```
Callout should mirror this exactly, plus `import { MessagesSquare } from 'lucide-react';` and `import type { CalloutBlock } from '@/lib/projectPage/blocks';`.

**Core uncontrolled-contentEditable pattern** (analog lines 10-33) — the load-bearing part to copy verbatim:
```tsx
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
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`${cls} ...`}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== text) onChange(next);
        }}
      />
      {!text && <span className="... placeholder">Heading {level}</span>}
    </div>
  );
}
```
**Critical guard to preserve exactly** (caret-jump prevention, RESEARCH.md Pitfall 3): `if (!el || document.activeElement === el) return;` — do not simplify or drop.

Callout differs from heading in two ways per UI-SPEC.md:
- No `onKeyDown` Enter-to-blur special case needed (harmless if kept, not required).
- Placeholder text is inline (`{block.text || 'Empty callout'}`) shown in read mode, not as an absolutely-positioned overlay span in edit mode — UI-SPEC.md mandates "identical container markup between read/edit, only difference is `contentEditable`+`onBlur`", which is a simpler pattern than heading's overlay-placeholder approach. Prefer the simpler `CalloutView`/`CalloutEditor` two-export shape given in RESEARCH.md Pattern 1 (lines 160-191 of RESEARCH.md), reproduced here as the target shape:

```tsx
export function CalloutView({ block }: { block: CalloutBlock }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-3 text-sm bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-300">
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
    <div className="flex items-start gap-2 rounded-xl border px-3 py-3 text-sm bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-300">
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
```

Note: UI-SPEC.md specifies `px-3 py-3` (not RESEARCH.md's `py-2.5`) to satisfy the 4px spacing grid — use `py-3`, and drop the `tone` map (UI-SPEC.md fixes tone to a single info-blue, config-free, per Open Question 1 resolution: no settings panel, no `PageBlockSettings.tsx` change). So the `CalloutBlock` interface should NOT include a `tone` field despite RESEARCH.md Pattern 1 suggesting one — UI-SPEC.md supersedes RESEARCH.md here (color contract section: "Accent reserved for... single fixed tone: info-blue. No tone picker, no per-instance color choice").

**Error handling:** None needed — client-side only, no network/validation calls (confirmed in UI-SPEC.md Copywriting Contract: "Error state: n/a").

---

### `apps/workspaces/src/lib/projectPage/blocks.ts` (edit, 3 insertion points)

**Analog:** itself — existing `HeadingBlock`/`DividerBlock` interfaces and their `PAGE_BLOCK_REGISTRY` entries.

**1. `PageBlockKind` union** (lines 13-55, current state) — insert `| 'callout'` in the "Content" group (after `'divider'`, matching RESEARCH.md's placement recommendation):
```typescript
export type PageBlockKind =
  // Content
  | 'rich-text'
  | 'heading'
  | 'divider'
  | 'callout'   // ← new
  | 'list'
  ...
```

**2. Block interface** (analog: `HeadingBlock`, lines 72-76):
```typescript
export interface HeadingBlock extends PageBlockBase {
  kind: 'heading';
  text: string;
  level: 1 | 2 | 3;
}
```
Callout target shape (no `tone` field per UI-SPEC.md override above):
```typescript
export interface CalloutBlock extends PageBlockBase {
  kind: 'callout';
  text: string;
}
```
Add `CalloutBlock` to the `PageBlock` union near line 262 (where `HeadingBlock` sits in the union list).

**3. `PAGE_BLOCK_REGISTRY` entry** (lines 327-350, analog: `heading`/`divider` entries):
```typescript
{
  kind: 'heading', group: 'content', title: 'Heading', icon: 'Heading',
  description: 'A section title.', available: true,
  create: () => ({ id: uid(), kind: 'heading', span: 'full', text: 'Section', level: 2 }),
},
...
{
  kind: 'divider', group: 'content', title: 'Divider', icon: 'Minus',
  description: 'A horizontal rule to separate sections.', available: true,
  create: () => ({ id: uid(), kind: 'divider', span: 'full' }),
},
```
Callout target entry (copy exact copy strings from UI-SPEC.md Copywriting Contract):
```typescript
{
  kind: 'callout', group: 'content', title: 'Callout', icon: 'MessagesSquare',
  description: 'A highlighted note or tip.', available: true,
  create: () => ({ id: uid(), kind: 'callout', span: 'full', text: '' }),
},
```
Icon MUST be `'MessagesSquare'` (or another name already in `icon.tsx`'s `MAP` — verified full list at `apps/workspaces/src/components/projectPage/icon.tsx` lines 14-20). Do not introduce a new lucide import there.

---

### `apps/workspaces/src/lib/projectPage/registry.tsx` (edit, 2 insertion points)

**Analog:** itself — the `'heading': entry(...)` block (lines 91-100) is the exact template since both blocks are plain-text with an editor.

**Type-only import addition** (top of file, lines 13-21) — add `CalloutBlock` to the type import list:
```typescript
import type {
  PageBlock, PageBlockKind,
  RichTextBlock, HeadingBlock, ListBlock, ...
  CalloutBlock, // ← new
  ...
} from './blocks';
```

**Component import** (near line 28, alongside `EditableHeading` import):
```typescript
import { CalloutView, CalloutEditor } from '@/components/projectPage/CalloutBlock';
```

**Entries record addition** (analog exact pattern, lines 91-100):
```typescript
'heading': entry('heading',
  ({ block }) => <HeadingView block={block as HeadingBlock} />,
  ({ block, onUpdate }) => (
    <EditableHeading
      level={(block as HeadingBlock).level}
      text={(block as HeadingBlock).text}
      onChange={(text) => onUpdate({ ...(block as HeadingBlock), text })}
    />
  ),
),
```
Callout target entry — place immediately after `'divider'` (mirrors PAGE_BLOCK_REGISTRY order per file header comment: "Entry order mirrors PAGE_BLOCK_REGISTRY"):
```typescript
'callout': entry('callout',
  ({ block }) => <CalloutView block={block as CalloutBlock} />,
  ({ block, onUpdate }) => <CalloutEditor block={block as CalloutBlock} onUpdate={(b) => onUpdate(b)} />,
),
```

**Compile-time exhaustiveness note (Pitfall 2):** `entries` is typed `Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>>` (line 90) — omitting `'callout'` here after adding it to the `PageBlockKind` union fails `tsc --noEmit`. This is the built-in verification step; add both in the same edit pass.

---

### `apps/workspaces/src/lib/miniProgram/plugins/examples.ts` (edit, 2 insertion points)

**Analog:** `dedupe` and `wordCount` `PluginBlockManifest` const objects (lines 8-69, read in full — 72-line file).

**Core manifest shape to copy** (analog: `wordCount`, lines 39-69, chosen because it is the simpler of the two — single settings field, one uiSchema node, trivial transform):
```typescript
const wordCount: PluginBlockManifest = {
  id: 'vectra.wordcount',
  version: '1.0.0',
  title: 'Word count column',
  description: 'Add a column with the number of words in a chosen text column.',
  icon: 'Hash',
  group: 'process',
  origin: 'builtin',
  settingsSchema: [
    { key: 'column', label: 'Text column', type: 'column' },
    { key: 'into', label: 'New column name', type: 'text', default: 'word_count' },
  ],
  uiSchema: [
    { node: 'text', text: 'Counts words in "{{config.column}}" → "{{config.into}}".', variant: 'muted' },
  ],
  logic: {
    kind: 'transform',
    source: `
      var col = config.column;
      ...
      return rows.map(function (r) { ... });
    `,
  },
};
```

**Target new const** (per RESEARCH.md Pattern 2, config-free, trivial pass-through per Security Domain guidance — "logic.source should stay a trivial pass-through with no need to test sandbox boundaries further"):
```typescript
const rowCountCallout: PluginBlockManifest = {
  id: 'vectra.rowcountcallout',
  version: '1.0.0',
  title: 'Row count callout',
  description: 'Shows a highlighted badge with the current row count of the incoming dataset.',
  icon: 'MessagesSquare',
  group: 'output',
  origin: 'builtin',
  settingsSchema: [],
  uiSchema: [
    { node: 'text', text: 'Current dataset:', variant: 'muted' },
    { node: 'badge', text: '{{count}} rows', tone: 'neutral' },
  ],
  logic: { kind: 'transform', source: 'return { rows: rows };' },
};
```

**Export array update** (analog line 71):
```typescript
export const EXAMPLE_PLUGINS: PluginBlockManifest[] = [dedupe, wordCount];
```
→
```typescript
export const EXAMPLE_PLUGINS: PluginBlockManifest[] = [dedupe, wordCount, rowCountCallout];
```

**Validation:** `uiSchema` node kinds (`text`, `badge`) must stay within the existing vocabulary — `validateManifest()` in `apps/workspaces/src/lib/miniProgram/plugins/manifest.ts` rejects unknown node kinds (per RESEARCH.md "Don't Hand-Roll" table). Do not introduce new `UiNode`/`FieldSpecType` kinds.

---

## Shared Patterns

### Uncontrolled contentEditable with focus guard
**Source:** `apps/workspaces/src/components/projectPage/EditableHeading.tsx` lines 15-19
**Apply to:** `CalloutBlock.tsx`'s `CalloutEditor`
```tsx
useEffect(() => {
  const el = ref.current;
  if (!el || document.activeElement === el) return;
  if ((el.textContent ?? '') !== text) el.textContent = text;
}, [text]);
```
This guard is the single most load-bearing line in the whole phase — every text-bearing block on the canvas uses it to avoid React reconciliation resetting DOM selection mid-typing (caret jump). Copy verbatim, do not "simplify."

### Registry exhaustiveness (compile-time contract, ENG-03)
**Source:** `apps/workspaces/src/lib/projectPage/registry.tsx` line 90 (`Record<PageBlockKind, WorkspaceBlockPlugin<PageBlock, PageCtx>>`)
**Apply to:** Every `PageBlockKind` union addition — `tsc --noEmit -p apps/workspaces/tsconfig.json` fails until the matching `entries` key exists. Treat as the verification gate for this phase's native-block work.

### Icon name reuse from hardcoded MAP
**Source:** `apps/workspaces/src/components/projectPage/icon.tsx` lines 14-20
**Apply to:** The `PAGE_BLOCK_REGISTRY` entry's `icon` field and the manifest plugin's `icon` field — both must use a name already present in this `Record<string, LucideIcon>` (e.g. `MessagesSquare`) or resolution silently falls back to `Square` with zero compile/runtime error.

### Plain-text-only storage (no HTML/DOMPurify)
**Source:** contrast with `RichTextBlock`/`ListBlock` (`blocks.ts` lines 66-70, 82-87) which store sanitised HTML
**Apply to:** `CalloutBlock.text` — must be `textContent`-based plain string, never `dangerouslySetInnerHTML`, per UI-SPEC.md V5 input-validation note and RESEARCH.md Security Domain section. Zero XSS surface, zero DOMPurify import needed.

## No Analog Found

None — all four files have exact analogs already in the codebase (this phase is explicitly a "proof" phase reusing 100% pre-existing seams; RESEARCH.md confirms no new abstraction is required).

## Metadata

**Analog search scope:** `apps/workspaces/src/lib/projectPage/`, `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/lib/miniProgram/plugins/`
**Files scanned:** `blocks.ts`, `registry.tsx`, `EditableHeading.tsx`, `icon.tsx`, `plugins/examples.ts` (all read in full; no file exceeded 2,000 lines, single-pass reads used throughout)
**Pattern extraction date:** 2026-07-11
