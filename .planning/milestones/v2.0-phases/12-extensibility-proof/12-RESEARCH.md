# Phase 12: Extensibility Proof - Research

**Researched:** 2026-07-11
**Domain:** Frontend plugin-registry extensibility (Next.js/React, `apps/workspaces`)
**Confidence:** HIGH

## Summary

Phases 7-11 already finished the hard work: `PageBlockView`, `LivePageCanvas`'s `BlockEditor`, `BlockView.tsx` (mini-program), and the slash/insert palettes all dispatch generically through `WorkspaceBlockRegistry` / `buildPaletteItems` — there is no `switch(block.kind)` left in any of the four files named in the phase's success criteria. This means Phase 12 is **not** an engine-building phase; it is a proof phase. The work is: (1) add one trivial native block (`callout`) by touching only `blocks.ts` (union + registry metadata), `registry.tsx` (plugin entry), and a small new view/editor component file; (2) add one trivial manifest plugin object to `lib/miniProgram/plugins/examples.ts`. Nothing else in the render/edit/palette pipeline needs to change — this was verified directly by reading the current dispatch code, not assumed.

One real landmine exists that is *not* mentioned in the roadmap: `components/projectPage/icon.tsx` is a hardcoded `Record<string, LucideIcon>` string→component map. If the new `callout` block's `icon` field names a lucide icon not already in that map, it silently falls back to a generic `Square` icon — it won't error, but it also won't render the intended icon, and touching `icon.tsx` would add a file to `git diff --stat` beyond "the block's own module + registry files" (criterion 3). The safe path is to reuse an icon name already present in the map (e.g. `'FileText'`, `'MessagesSquare'`, or `'BookText'`/`NotebookText`) rather than introduce a new lucide import.

Similarly, `components/projectPage/PageBlockSettings.tsx` has its own `switch(block.kind)` for the settings panel — but it is not one of the four files the roadmap calls out, and its `default: return null` already handles any kind without a case, so a config-less `callout` block needs **zero** changes there either. If the plan later gives `callout` a variant/tone picker, one case would need to be added — call this out as an explicit scope decision for the planner (recommend: keep `callout` config-free, span+text only, to preserve the "nothing else changes" story cleanly).

**Primary recommendation:** Add `callout` as a plain-text, DOMPurify-free (contentEditable-free, `textContent`-based) block modeled directly on the existing `heading` block's `EditableHeading` pattern — same shape (`text: string`), same uncontrolled contentEditable editor pattern, same "falls back to render() when no editor" default for read mode. Add the manifest plugin as a third entry in `EXAMPLE_PLUGINS` (alongside `dedupe`/`wordCount`), reusing the existing `text`/`badge` UI-node vocabulary — no new `UiNode` types needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Native `callout` block render/edit | Frontend (Next.js client component) | — | Page blocks are pure client-side React; no server involvement (page config is opaque JSONB to the API) |
| Native `callout` registry entry | Frontend (`lib/projectPage/registry.tsx`) | — | Registry is a `'use client'` module instantiated once per app load |
| Slash-palette appearance | Frontend (`lib/projectPage/slashMenu.ts` via `buildPaletteItems`) | — | Already generic; no tier change needed |
| Autosave persistence | Frontend → API (envelope-only validation) → Database (JSONB) | — | API's `PageConfigSchema` treats `blocks` as `z.array(z.unknown())` — new block kinds need no backend change |
| Manifest plugin (`examples.ts`) | Frontend (`lib/miniProgram/plugins/registry.ts` in-memory store) | — | Plugin registry is process-wide, client-side, seeded from `EXAMPLE_PLUGINS`; no persistence/API layer involved yet (that's Phase K, out of scope) |
| Manifest plugin sandboxed logic | Frontend (Web Worker sandbox, `plugins/sandbox.ts`) | — | `runInSandbox` already generic; a plugin with `logic.kind: 'transform'` needs no sandbox changes |

## Standard Stack

No new packages required. This phase is purely additive TypeScript/TSX inside the existing `apps/workspaces` Next.js 14 / React 18 / TailwindCSS stack. `lucide-react` (already a dependency) supplies icons; `dompurify` (already a dependency) is available if the planner chooses an HTML-capable callout, but is **not** needed if `callout` stores plain text (recommended).

**Installation:** None — no new dependencies.

## Package Legitimacy Audit

Not applicable — this phase installs no new packages.

## Architecture Patterns

### System Architecture Diagram

```
Author types "/" in a rich-text block on the live canvas
        │
        ▼
EditableRichText detects trigger → LivePageCanvas.handleSlashSelect(hostIndex, item, ctx)
        │  item comes from buildSlashMenuItems() → buildPaletteItems(pageBlockRegistry)
        │  (registry-derived; "callout" appears automatically once registered)
        ▼
item.create() → new CalloutBlock{ id, kind:'callout', span, text:'' }
        │
        ▼
LivePageCanvas.updateBlock() → onChange(PageConfig) → parent page state
        │
        ├─── read path ────────────────────────────────────────────┐
        │                                                          ▼
        │                                          PageBlockView(block, ctx)
        │                                          → pageBlockRegistry.render(block, ctx)
        │                                          → entries['callout'].renderer  → CalloutView
        │
        └─── edit path ───────────────────────────────────────────┐
                                                                   ▼
                                                LivePageCanvas.BlockEditor(block, ctx)
                                                → pageBlockRegistry.renderEditor(block, ctx, onUpdate)
                                                → entries['callout'].editor → CalloutEditor
                                                    (falls back to .renderer if no .editor given)
        │
        ▼
autosave PATCH (existing hook, unchanged) ──▶ apps/api PageConfigSchema (envelope-only, z.unknown() blocks)
        │
        ▼
project_pages.config JSONB (Postgres) — round-trips byte-identical on reload

── Manifest path (separate, mini-program domain) ──
examples.ts: EXAMPLE_PLUGINS += calloutPlugin (PluginBlockManifest)
        │
        ▼
pluginRegistry (in-memory store, seeded from EXAMPLE_PLUGINS) — usePlugins() re-renders builder
        │
        ▼
MiniProgramBuilder "Add block" → createPluginBlock(manifest) → PluginBlockInstance{kind:'plugin', pluginId:'vectra.callout'}
        │
        ▼
BlockView(block) → miniProgramBlockRegistry.render(block, {}) → keyOf resolves 'plugin' → not a static key
        → renderManifest(block, ctx) → DynamicBlockView → getPlugin(pluginId) → interprets uiSchema generically
```

### Recommended Project Structure

No new directories. New/changed files only:

```
apps/workspaces/src/lib/projectPage/
├── blocks.ts                    # (edit) + CalloutBlock interface, PageBlockKind union member,
│                                 #         PageBlock union member, PAGE_BLOCK_REGISTRY entry
└── registry.tsx                 # (edit) + one `entry('callout', CalloutView, CalloutEditor)` line

apps/workspaces/src/components/projectPage/
└── CalloutBlock.tsx              # (new) CalloutView + CalloutEditor — ~15-20 lines total

apps/workspaces/src/lib/miniProgram/plugins/
└── examples.ts                   # (edit) + one PluginBlockManifest object, add to EXAMPLE_PLUGINS array
```

No changes to: `PageBlockView.tsx`, `LivePageCanvas.tsx`, `pageBlockViews.tsx` (optional — could add there instead of a new file, see Pattern 1), `slashMenu.ts`, `BlockView.tsx`, `DynamicBlockView.tsx`, `MiniProgramBuilder.tsx`, `icon.tsx` (if an existing icon name is reused), `PageBlockSettings.tsx` (if `callout` stays config-free), any API/backend file, any SQL migration.

### Pattern 1: Adding a trivial native page block (the `callout` proof)

**What:** A `PageBlock` union member + `WorkspaceBlockPlugin` entry, nothing else.
**When to use:** Any future block that only needs to read/write its own fields and has no cross-block runtime dependency (mirrors `heading`, the smallest existing content block).

**Step-by-step (exact files, exact shapes):**

1. **`lib/projectPage/blocks.ts`** — add to the `PageBlockKind` union (line ~13-55):
```typescript
// Source: apps/workspaces/src/lib/projectPage/blocks.ts (existing pattern, verified)
export type PageBlockKind =
  | 'rich-text'
  | 'heading'
  | 'callout'   // ← new
  | 'divider'
  // ...
```

2. Add the interface (mirrors `HeadingBlock` exactly, one extra field for tone):
```typescript
export interface CalloutBlock extends PageBlockBase {
  kind: 'callout';
  text: string;
  tone: 'info' | 'warning' | 'success';
}
```

3. Add `CalloutBlock` to the `PageBlock` union (near `HeadingBlock`).

4. Add one entry to `PAGE_BLOCK_REGISTRY` (this is what `buildPaletteItems` reads for the slash menu — criterion 2's "appears in the slash palette" is satisfied purely by this array entry, no `slashMenu.ts` edit):
```typescript
{
  kind: 'callout', group: 'content', title: 'Callout', icon: 'MessagesSquare', // reuse existing mapped icon — see Pitfall 1
  description: 'A highlighted note or tip.', available: true,
  create: () => ({ id: uid(), kind: 'callout', span: 'full', text: '', tone: 'info' }),
},
```
(Place it in the `content` group, after `divider`, to sit alongside rich-text/heading/list — matches its role as a content block, not a data widget.)

5. **`components/projectPage/CalloutBlock.tsx`** (new file) — read view + inline editor, modeled directly on `EditableHeading.tsx`:
```tsx
'use client';
// Source: pattern copied from apps/workspaces/src/components/projectPage/EditableHeading.tsx
import { useEffect, useRef } from 'react';
import { MessagesSquare } from 'lucide-react';
import type { CalloutBlock } from '@/lib/projectPage/blocks';

const TONE_CLS: Record<CalloutBlock['tone'], string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-300',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-300',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/40 dark:text-emerald-300',
};

export function CalloutView({ block }: { block: CalloutBlock }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${TONE_CLS[block.tone]}`}>
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
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${TONE_CLS[block.tone]}`}>
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
(~28 lines including both components and the tone map — comfortably within the "~15-line renderer/editor" spirit once you count only the renderer OR only the editor; the roadmap's "~15-line" is a rough size signal, not a hard cap.)

6. **`lib/projectPage/registry.tsx`** — import the two components and add one line to the `entries` record:
```typescript
import { CalloutView, CalloutEditor } from '@/components/projectPage/CalloutBlock';
// ...
'callout': entry('callout',
  ({ block }) => <CalloutView block={block as CalloutBlock} />,
  ({ block, onUpdate }) => <CalloutEditor block={block as CalloutBlock} onUpdate={(b) => onUpdate(b)} />,
),
```
Also add `CalloutBlock` to the type-only import list at the top of `registry.tsx`.

**That is the entire native-block diff.** `PageBlockView.tsx` calls `pageBlockRegistry.render(...)` generically (verified — no switch). `LivePageCanvas`'s `BlockEditor` calls `pageBlockRegistry.renderEditor(...)` generically (verified). `slashMenu.ts`'s `buildSlashMenuItems()` iterates `buildPaletteItems(pageBlockRegistry)` generically except for its two hand-expanded kinds (`heading`, `list`) — `callout` is not one of those, so it flows through the generic loop untouched (verified by reading `slashMenu.ts` lines 86-97).

### Pattern 2: Adding a trivial manifest plugin (the declarative-path proof)

**What:** One `PluginBlockManifest` object added to `EXAMPLE_PLUGINS` in `lib/miniProgram/plugins/examples.ts`.
**When to use:** Any plugin whose behavior fits the existing `settingsSchema`/`uiSchema`/`logic` vocabulary (no new `FieldSpecType` or `UiNode` kind).

```typescript
// Source: apps/workspaces/src/lib/miniProgram/plugins/examples.ts (existing pattern, verified)
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

export const EXAMPLE_PLUGINS: PluginBlockManifest[] = [dedupe, wordCount, rowCountCallout];
```

**That is the entire manifest-plugin diff** — one new const + one array entry. `pluginRegistry` (in `plugins/registry.ts`) seeds from `EXAMPLE_PLUGINS` in its constructor (verified), `usePlugins()` is a `useSyncExternalStore` hook the builder already calls, so the new plugin appears in `MiniProgramBuilder`'s "Add block" list automatically. Adding a `PluginBlockInstance{kind:'plugin', pluginId:'vectra.rowcountcallout', ...}` block to any mini program config and running the player exercises `BlockView` → `miniProgramBlockRegistry.render` → `keyOf` (resolves to `pluginId`, not a static entry) → `renderManifest` → `DynamicBlockView` → `getPlugin(pluginId)` → interprets `uiSchema` — all pre-existing, generic code (verified by reading `registry.tsx`, `DynamicBlockView.tsx`).

### Anti-Patterns to Avoid

- **Adding a case to `PageBlockSettings.tsx`'s switch for `callout`:** Not required if `callout` stays config-free (its `default: return null` already handles it). Adding a case is optional scope creep that isn't covered by criterion 1-4 and would add a file to the diff beyond "the block's own module + registry files."
- **Introducing a new lucide icon name not already in `icon.tsx`'s `MAP`:** Silently degrades to the `Square` fallback and, if fixed by editing `icon.tsx`, adds an extra file to `git diff --stat`. Reuse an existing mapped name.
- **Giving `callout` rich HTML content (like `rich-text`/`list`):** Forces a DOMPurify `dangerouslySetInnerHTML` path and a `contentEditable` + `EditableRichText`-style slash-aware editor — unnecessary complexity for a "trivial" proof block. Plain `textContent` (like `heading`) is simpler and has zero XSS surface.
- **Adding a new `FieldSpecType` or `UiNode` kind for the manifest plugin:** The roadmap explicitly wants this proven via "the declarative path" using existing vocabulary — extending the vocabulary is a real engine change (out of scope for EXT-02, which is about proving the existing seam, not growing it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon resolution for the new block | A new icon-lookup mechanism | Reuse an existing entry in `components/projectPage/icon.tsx`'s `MAP` | Avoids touching a 5th file; keeps `git diff --stat` scoped per criterion 3 |
| Inline editor for plain text | A custom `<input>`/`<textarea>` state-management pattern | Copy `EditableHeading.tsx`'s uncontrolled-contentEditable-with-blur-sync pattern | Matches project convention exactly (already used by `heading`); avoids re-render-resets-caret bugs textareas don't have this issue with but contentEditable does — consistency > invention |
| Manifest plugin UI | A new `UiNode` type | Compose existing nodes (`text`, `badge`, `stack`, `row`) | `validateManifest()` in `manifest.ts` rejects unknown node kinds; the vocabulary is intentionally fixed |

**Key insight:** Every extensibility seam this phase needs to prove already exists and was exercised by 20+ prior block kinds (native) and 2 prior plugins (manifest). There is no new abstraction to design — the task is executing the existing contract once, correctly, and verifying nothing else moved.

## Common Pitfalls

### Pitfall 1: Icon name not in `icon.tsx`'s hardcoded map
**What goes wrong:** The new block renders with a generic gray `Square` icon in the palette instead of the intended icon, with no compile error or runtime warning.
**Why it happens:** `PageBlockIcon` resolves icon names via a hand-maintained `Record<string, LucideIcon>`; unregistered names silently fall through to the `Square` default (`icon.tsx` line 23: `(name && MAP[name]) || Square`).
**How to avoid:** Pick an `icon` string from the list already in `MAP` (verified full list: `Heading, Type, Minus, Users, Gauge, Target, BarChart3, History, FileCode2, Calendar, Mail, LayoutDashboard, NotebookText, FileText, Heading1/2/3, List, ListOrdered, Play, Kanban, Truck, Calculator, Radar, MessagesSquare, ScanText, ClipboardCheck, Warehouse, TrainTrack, PackageCheck, Building2, Percent, Receipt, Sparkles`). `MessagesSquare` fits "callout" reasonably well.
**Warning signs:** Palette entry shows a plain square icon after implementation — check `icon.tsx`'s `MAP` immediately.

### Pitfall 2: Forgetting `PageBlockKind` compile-time exhaustiveness (ENG-03) means the `entries` Record in `registry.tsx` MUST have every key
**What goes wrong:** `tsc --noEmit` fails with a missing-property error on `entries: Record<PageBlockKind, WorkspaceBlockPlugin<...>>` if `callout` is added to the union but not to `entries`.
**Why it happens:** This is by design (Phase 7's ENG-03 compile-time exhaustiveness guarantee) — it is a feature, not a bug, and doubles as the verification step that the registry entry was actually added.
**How to avoid:** Add the union member and the `entries` record key in the same commit; run `tsc --noEmit` before considering the task done.
**Warning signs:** TypeScript error referencing `Record<PageBlockKind, ...>` and the string `'callout'`.

### Pitfall 3: contentEditable caret jumps if the editor component re-renders while focused
**What goes wrong:** Typing in the callout editor loses cursor position or jumps to the end after every keystroke.
**Why it happens:** React reconciliation touching a `contentEditable` element's children while the user is mid-edit resets the DOM selection — this is the exact reason `EditableHeading.tsx` guards its `useEffect` with `document.activeElement === el`.
**How to avoid:** Copy the guard verbatim (`if (!el || document.activeElement === el) return;`) — do not "simplify" it away.
**Warning signs:** Manual test: typing multiple characters quickly causes visible caret jump or reversed character order.

### Pitfall 4: `git diff --stat` scope creep from IDE auto-imports or formatting
**What goes wrong:** Criterion 3 ("touches only the block's own module + registry files") fails because an editor auto-organizes imports in an unrelated file, or a linter reformats a file incidentally opened during the change.
**Why it happens:** Editors/IDEs often "helpfully" touch adjacent files (e.g., reordering imports in `pageBlockViews.tsx` if it was opened for reference).
**How to avoid:** After implementation, run `git diff --stat` yourself and confirm the file list is exactly: `blocks.ts`, `registry.tsx`, the new `CalloutBlock.tsx`, and `plugins/examples.ts` — nothing else. Revert any incidental changes.
**Warning signs:** `git diff --stat` shows a file with only whitespace/import-order changes and no logical edit.

## Code Examples

### The generic render dispatch already in place (no changes needed)
```tsx
// Source: apps/workspaces/src/components/projectPage/PageBlockView.tsx (verified, current state)
export function PageBlockView({ block, projectId, clientId, onChange }: {...}) {
  return <>{pageBlockRegistry.render(block, { projectId, clientId, onChange })}</>;
}
```

### The generic edit dispatch already in place (no changes needed)
```tsx
// Source: apps/workspaces/src/components/projectPage/LivePageCanvas.tsx (verified, current state)
function BlockEditor({ block, projectId, clientId, slashItems, onUpdate, onSlashSelect }: {...}) {
  return <>{pageBlockRegistry.renderEditor(block, { projectId, clientId, slashItems, onSlashSelect }, onUpdate)}</>;
}
```

### The generic palette derivation already in place (no changes needed)
```typescript
// Source: apps/workspaces/src/lib/projectPage/slashMenu.ts (verified, current state)
for (const item of buildPaletteItems(pageBlockRegistry)) {
  const kind = item.key as PageBlockKind;
  if (kind === 'heading' || kind === 'list') continue; // only these two are hand-expanded
  items.push({ id: kind, kind, title: item.title, description: item.description,
    keywords: [item.title.toLowerCase(), ...(EXTRA_KEYWORDS[kind] ?? [])],
    icon: item.icon, group: item.group as PageBlockGroup, create: item.create });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `switch(block.kind)` in `PageBlockView`, `LivePageCanvas`, `BlockView`, `slashMenu.ts` | `WorkspaceBlockRegistry.render()` / `.renderEditor()` / `buildPaletteItems()` | Phases 7-11 (2026-07-06 to 2026-07-11) | Adding a block kind no longer requires touching any dispatch file — this phase is the proof of that claim |

**Deprecated/outdated:** None — this phase doesn't remove anything; Phase 13 (Cleanup) is where any residual dead switch code gets deleted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MessagesSquare` is an acceptable/appropriate icon choice for a "callout" block conceptually (not just technically present in the map) | Pattern 1, Pitfall 1 | Low — purely cosmetic; any other already-mapped icon name works equally well technically. Planner/user can pick a different mapped name (e.g. `FileText`) with zero code-structure impact. |
| A2 | A `tone` field (`info`/`warning`/`success`) on `CalloutBlock` is within the "trivial" spirit intended by the roadmap, rather than a bare text-only block | Pattern 1 | Low — if the planner wants strictly minimal, drop `tone` and hardcode one color; either way the file-touch set is identical. |

**If this table is empty:** N/A — see entries above; both are low-risk cosmetic/scope judgment calls, not verified against an external source, flagged for planner discretion.

## Open Questions (RESOLVED)

1. **Should `callout` support a settings-panel tone picker (touching `PageBlockSettings.tsx`), or stay config-free?**
   - What we know: `PageBlockSettings.tsx`'s `default: return null` already handles any kind with no case — zero changes are required if `callout` has no settings UI.
   - What's unclear: Whether "trivial" in the roadmap implies the block should still be usefully configurable (tone), which would need one `case 'callout':` added.
   - Recommendation: Keep `callout` render-only configurable (fixed tone, or tone hardcoded to `'info'` and dropped entirely) so the "zero changes to dispatch files" story stays clean; if the user wants a tone picker in discuss-phase, it's a 5-line addition to `PageBlockSettings.tsx` and explicitly not one of the four protected files anyway.
   - **RESOLVED:** 12-UI-SPEC.md fixes the callout to a single hardcoded info-blue tone with no `tone` field and no settings picker, superseding this suggestion. Adopted as-is in 12-01-PLAN.md.

2. **Does the manifest plugin need to actually be inserted into a real mini-program's `config.blocks` (persisted), or is "renders end-to-end" satisfiable by adding it to `EXAMPLE_PLUGINS` and demonstrating it in the builder/player during manual verification?**
   - What we know: `EXAMPLE_PLUGINS` seeds the in-memory `pluginRegistry`; no code path requires a plugin to be referenced by a saved program to "exist" and be selectable.
   - What's unclear: Whether the phase's verification step should include creating (and persisting) an actual test mini-program that uses the new plugin block, vs. just confirming it appears in the "Add block" list and renders in an ad-hoc/unsaved builder session.
   - Recommendation: Plan should include an explicit verification task — add a `plugin` block instance of the new manifest to a scratch/test mini program, save it, reload the page, and confirm round-trip — this directly proves "renders end-to-end via the declarative path" rather than just "appears in a list."
   - **RESOLVED:** 12-02-PLAN.md includes an explicit save/reload/player round-trip checkpoint task per this recommendation.

## Environment Availability

No external dependencies for this phase — code/config-only changes within `apps/workspaces`. Node.js 24.14.0 and TypeScript 5.9.3 confirmed available in this environment (`tsc --noEmit` is usable for the exhaustiveness check).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/workspaces` (no jest/vitest config, no `*.test.*`/`*.spec.*` files found) |
| Config file | none — see Wave 0 |
| Quick run command | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` (type-check only; no runtime test suite exists) |
| Full suite command | Manual verification (browser) — see Phase Requirements → Test Map below |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-01 | `callout` union member + registry entry compiles, is exhaustive | type-check | `npx tsc --noEmit -p apps/workspaces/tsconfig.json` | ✅ (tsconfig exists) |
| EXT-01 | `callout` renders (read), appears in slash palette, edits inline, autosaves+reloads | manual-only | Open a project page, type `/`, select "Callout", type text, reload page, confirm text persisted | ❌ — no browser/e2e test infra exists; justified as manual-only since `apps/workspaces` has zero test framework today and adding one is out of this phase's scope |
| EXT-01 | `git diff --stat` touches only block module + registry files | procedural check | `git diff --stat` (run by the implementer/verifier, not a code test) | N/A |
| EXT-02 | Manifest plugin renders end-to-end via declarative path | manual-only | Add the new plugin block to a test mini program in the builder, save, reload, run in player | ❌ — same reason as above |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit -p apps/workspaces/tsconfig.json`
- **Per wave merge:** Manual browser verification of both success-criteria flows (native block round-trip; manifest plugin round-trip)
- **Phase gate:** Full manual verification + `git diff --stat` review before `/gsd:verify-work`

### Wave 0 Gaps
- No automated test framework exists in `apps/workspaces` (no jest/vitest/playwright config found). Installing one is out of scope for this small, additive phase — flagging as a pre-existing gap, not something to fix here. All phase verification is `tsc --noEmit` (compile-time) + manual browser check (runtime) + `git diff --stat` (scope check).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`'s `workflow` block; treated as enabled per protocol. This phase has a very small security surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched |
| V3 Session Management | no | Not touched |
| V4 Access Control | no | Page/program ownership checks are unchanged; new block kind carries no new permission logic |
| V5 Input Validation | yes (minor) | `callout.text` should be stored as plain text (`textContent`, not `innerHTML`) — avoids introducing an HTML-injection surface. The API's `PageConfigSchema` already treats `blocks` as opaque `z.unknown()`, so no schema tightening is needed or expected. |
| V6 Cryptography | no | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via a block's HTML field (relevant only if `callout` were given `dangerouslySetInnerHTML` content, as `rich-text`/`list` have) | Tampering/Elevation of Privilege | Avoid entirely by using `textContent`/plain string for `callout.text` (recommended in Pattern 1) rather than sanitized HTML; if a future revision wants rich text, reuse the existing `DOMPurify.sanitize()` call already used by `RichTextView`/`ListView` in `pageBlockViews.tsx` — never hand-roll sanitization |
| Manifest plugin sandbox escape (relevant to EXT-02's `logic.source`) | Elevation of Privilege | Already mitigated by the existing `runInSandbox` (hardened Web Worker, no DOM/network) — the new example plugin's `logic.source` should stay a trivial pass-through (`return { rows: rows };`) with no need to test sandbox boundaries further, since that's proven by the two existing example plugins |

## Sources

### Primary (HIGH confidence)
- Direct source read: `apps/workspaces/src/lib/workspaceEngine/{types.ts,registry.tsx,palette.ts,index.ts}` — full engine contract
- Direct source read: `apps/workspaces/src/lib/projectPage/{blocks.ts,registry.tsx,slashMenu.ts}` — page registry, exhaustiveness, palette derivation
- Direct source read: `apps/workspaces/src/components/projectPage/{PageBlockView.tsx,LivePageCanvas.tsx,pageBlockViews.tsx,EditableHeading.tsx,PageBlockSettings.tsx,icon.tsx}` — confirmed zero remaining switch statements in the four protected files; found the `icon.tsx` map pitfall
- Direct source read: `apps/workspaces/src/lib/miniProgram/{registry.tsx,blocks.ts}`, `plugins/{manifest.ts,registry.ts,examples.ts}`, `components/miniProgram/{BlockView.tsx,DynamicBlockView.tsx,MiniProgramBuilder.tsx}` — confirmed manifest-plugin declarative path is fully generic
- Direct source read: `apps/api/src/domains/projects/dto/page.dto.ts` — confirmed backend validates page config envelope only (`z.unknown()` blocks), no backend change needed
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — phase scope, dependency chain, prior-phase decisions

### Secondary (MEDIUM confidence)
- None used — all claims traced directly to source files in this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; existing stack confirmed by direct file reads
- Architecture: HIGH - dispatch pipeline read directly, not inferred; exhaustiveness/registry contract confirmed against Phase 7-11 code
- Pitfalls: HIGH - `icon.tsx` fallback behavior and `PageBlockSettings.tsx` switch confirmed by direct reading, not assumed

**Research date:** 2026-07-11
**Valid until:** 2026-07-18 (7 days — codebase is under active same-milestone development; re-verify registry/blocks.ts state before planning if more than a few days pass)
