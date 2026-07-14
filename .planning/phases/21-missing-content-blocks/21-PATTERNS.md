# Phase 21: Missing Content Blocks - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 16 (11 new components + `mentionMenu.ts` new + 4 modified core registry/menu files)
**Analogs found:** 16 / 16 (all in-codebase; no external analogs required)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/workspaces/src/lib/projectPage/blocks.ts` (modify) | model/registry | CRUD (union + factory) | itself (existing file, extend in place) | exact |
| `apps/workspaces/src/lib/projectPage/registry.tsx` (modify) | provider/registry | request-response (render dispatch) | itself (existing file, extend in place) | exact |
| `apps/workspaces/src/lib/projectPage/slashMenu.ts` (modify) | utility | transform (palette build/filter) | itself (existing file, extend in place) | exact |
| `apps/workspaces/src/lib/projectPage/mentionMenu.ts` (NEW) | utility | transform (query/filter for popover) | `apps/workspaces/src/lib/projectPage/slashMenu.ts` | exact (mirrors structure 1:1) |
| `apps/workspaces/src/components/projectPage/icon.tsx` (modify) | utility | transform (name→icon lookup) | itself (existing file, extend `MAP`) | exact |
| `apps/workspaces/src/components/projectPage/ChecklistBlock.tsx` (NEW) | component | CRUD (view+editor) | `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (item add/remove/toggle) | role-match |
| `apps/workspaces/src/components/projectPage/QuoteBlock.tsx` (NEW) | component | CRUD (view+editor) | `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` | exact |
| `apps/workspaces/src/components/projectPage/CodeBlock.tsx` (NEW) | component | CRUD (view+editor) | `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` (editor shape) + native `<select>` | role-match |
| `apps/workspaces/src/components/projectPage/MediaBlocks.tsx` (NEW: image/file/video/bookmark/embed) | component | CRUD, URL-only (request-response for og-data optional) | `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx` (dashed upload/URL card) + `CalloutBlock.tsx` (editor commit pattern) | role-match |
| `apps/workspaces/src/components/projectPage/TableBlock.tsx` (NEW) | component | CRUD (grid) | `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (add/remove row pattern) | role-match |
| `apps/workspaces/src/components/projectPage/ToggleBlock.tsx` (NEW) | component | CRUD + event-driven (collapse state) | NEW ground — closest: `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (nested-list add/remove without dnd-kit) + `PageTree.tsx` (expand/collapse chevron pattern) | partial (no true nesting precedent) |
| `apps/workspaces/src/components/projectPage/ColumnsBlock.tsx` (NEW) | component | CRUD (nested lanes) | same as ToggleBlock — shares nested mini-canvas mechanism | partial (no true nesting precedent) |
| `apps/workspaces/src/components/projectPage/SubPageBlock.tsx` (NEW) | component | request-response (create+navigate) | `apps/workspaces/src/components/projectPage/PageTree.tsx` (`PageRow`'s static row + navigate pattern) + `apps/workspaces/src/app/projects/[id]/page.tsx`'s `addSubPage()` | exact |
| `apps/workspaces/src/components/projectPage/MentionMenu.tsx` (NEW) | component | event-driven (popover) | `apps/workspaces/src/components/projectPage/SlashMenu.tsx` (`SlashMenuPanel`) | exact |
| `apps/workspaces/src/components/projectPage/EditableRichText.tsx` (modify — add `@` trigger) | component | event-driven (contentEditable trigger detection) | itself (existing `/`-trigger logic, lines 124-183) | exact |

## Pattern Assignments

### `apps/workspaces/src/lib/projectPage/blocks.ts` (model/registry, CRUD)

**Analog:** itself — follow the file's own "EXTENSIBILITY CONTRACT" comment (lines 8-11) plus the newly-required 4th step (icon.tsx MAP, see Pitfall 1 in RESEARCH.md).

**Union member pattern** (lines 83-93, existing `CalloutBlock`/`ListBlock` shape to clone):
```typescript
export interface CalloutBlock extends PageBlockBase {
  kind: 'callout';
  text: string;
}
export interface ListBlock extends PageBlockBase {
  kind: 'list';
  style: 'bulleted' | 'numbered';
  html: string;
}
```
Add new interfaces the same way: `ChecklistBlock { kind: 'checklist'; items: {id:string; text:string; done:boolean}[] }`, `QuoteBlock { kind: 'quote'; text: string }`, `CodeBlock { kind: 'code'; code: string; language: string }`, `ImageBlock`/`FileBlock`/`VideoBlock`/`BookmarkBlock`/`EmbedBlock { kind: '...'; url: string; caption?: string }`, `TableBlock { kind: 'table'; rows: string[][] }`, `SubPageBlock { kind: 'sub-page'; pageId: string; title: string }`, and the two nesting blocks:
```typescript
export interface ToggleBlock extends PageBlockBase {
  kind: 'toggle';
  title: string;
  collapsed: boolean;
  children: PageBlock[];
}
export interface ColumnsBlock extends PageBlockBase {
  kind: 'columns';
  columns: PageBlock[][]; // fixed length 2 (D-04 discretion — cheapest)
}
```
Add every new member to the `PageBlock` union (lines 266-297) and add a `PAGE_BLOCK_REGISTRY` entry per kind, following the existing entry shape (lines 334-498):
```typescript
{
  kind: 'callout', group: 'content', title: 'Callout', icon: 'MessagesSquare',
  description: 'A highlighted note or tip.', available: true,
  create: () => ({ id: uid(), kind: 'callout', span: 'full', text: '' }),
},
```
**New field required (per RESEARCH.md Pitfall 5 / Anti-Patterns):** add `nestable?: boolean` to `PageBlockDef` (line 322-332) — set `true` on text/heading/checklist/quote/code/media/table/sub-page entries, leave unset/`false` on toggle, columns, and every widget/data block (kanban, kpi-grid, chart, crm-clients, etc.) per D-03. Do NOT reuse `PageBlockGroup` for this — it already means something else (transform-in-place eligibility, see `isContentItem()`).

**Error handling:** none needed — this file is pure data/factory, no I/O.

---

### `apps/workspaces/src/lib/projectPage/registry.tsx` (provider/registry, request-response)

**Analog:** itself — one `entry(...)` call per new kind, in the `entries` Record (lines 91-159).

**Core pattern** (lines 126-129, callout's entry — exact template for quote/checklist/code/table/media/sub-page):
```typescript
'callout': entry('callout',
  ({ block }) => <CalloutView block={block as CalloutBlock} />,
  ({ block, onUpdate }) => <CalloutEditor block={block as CalloutBlock} onUpdate={(b) => onUpdate(b)} />,
),
```
For rich-text-editing blocks that need the slash-menu wired through (unlikely needed here since new blocks aren't rich-text hosts), see the `'rich-text'` entry (lines 102-113) for the `ctx.slashItems`/`ctx.onSlashSelect` wiring shape — reuse only if a new block's editor embeds an `EditableRichText` instance (e.g., table cells or checklist item text, if chosen to support inline formatting; otherwise plain `contentEditable`/`<input>` is enough per the UI-SPEC's plain-text row shapes).

For toggle/columns, the renderer/editor must pass a filtered nested slash-menu (only `nestable: true` items) down into a new lightweight nested-mini-canvas component (not `LivePageCanvas`) — this is genuinely new wiring with no 1:1 analog; base it on the `entry()` shape but the editor prop needs `ctx` access to build nested items via `buildPaletteItems(pageBlockRegistry).filter(i => pageBlockDef(i.key)?.nestable)`.

**Import pattern** (lines 12-52) — every new view/editor component gets one named import here, mirroring:
```typescript
import { CalloutView, CalloutEditor } from '@/components/projectPage/CalloutBlock';
```

---

### `apps/workspaces/src/lib/projectPage/slashMenu.ts` (utility, transform)

**Analog:** itself.

**EXTRA_KEYWORDS pattern** (lines 26-53) — add one entry per new kind:
```typescript
const EXTRA_KEYWORDS: Partial<Record<PageBlockKind, string[]>> = {
  'kanban': ['board', 'columns', 'cards', 'tasks'],
  // add: 'checklist': ['todo', 'checkbox', 'task'], 'toggle': ['collapse', 'expand', 'accordion'],
  // 'quote': ['blockquote', 'citation'], 'code': ['snippet', 'syntax', 'programming'],
  // 'image'/'file'/'video'/'bookmark'/'embed': [...], 'table': ['grid', 'spreadsheet'],
  // 'columns': ['layout', 'side-by-side', 'lanes'], 'sub-page': ['page', 'child', 'nested'],
};
```
**Group + nestable filter pattern** (lines 108-111, `isContentItem` — clone the SHAPE, not the semantics, for a new `isNestableItem`):
```typescript
export function isContentItem(item: SlashMenuItem): boolean {
  return item.group === 'content';
}
```
New function needed (per RESEARCH.md): `isNestableItem(item)` must check the new `nestable` flag on `PageBlockDef` (via `pageBlockDef(item.kind)?.nestable`), NOT `item.group`, since sub-page/media/table are `'widget'`-grouped but ARE nestable.

---

### `apps/workspaces/src/lib/projectPage/mentionMenu.ts` (NEW, utility, transform)

**Analog:** `apps/workspaces/src/lib/projectPage/slashMenu.ts` (mirror structurally, different data source).

**Structure to mirror** (whole-file pattern from `slashMenu.ts` lines 14-111): an item interface (`MentionMenuItem`), a `buildMentionItems(query, ctx)` async/sync builder pulling from `teamApi.list()` (person), `projectsApi.listPages(projectId)` (page, current-project scope per Open Question 1/A2), and a pure client-side date-token parser (date), plus a `filterMentionItems` substring filter identical in shape to `filterSlashMenuItems` (lines 101-106):
```typescript
export function filterSlashMenuItems(items: SlashMenuItem[], query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) =>
    it.title.toLowerCase().includes(q) || it.keywords.some((k) => k.includes(q)));
}
```
Group by type (People / Pages / Dates) mirroring the `GROUP_LABEL` pattern in `SlashMenu.tsx` (see below).

---

### `apps/workspaces/src/components/projectPage/icon.tsx` (utility, transform)

**Analog:** itself.

**Pattern** (whole file, 25 lines) — import new lucide icons and add to `MAP`:
```typescript
import {
  Heading, Type, Minus, /* ...existing... */ Sparkles, type LucideIcon,
} from 'lucide-react';
const MAP: Record<string, LucideIcon> = {
  Heading, Type, Minus, /* ...existing... */ Sparkles,
};
```
Add: `CheckSquare` (checklist), `ChevronRight`/`ChevronDown` already imported elsewhere but needed here too (toggle), `Quote` (quote), `Code2` (code), `Image`, `File`, `Video`/`Play` (reuse existing `Play`), `Bookmark`, `Frame` (embed), `Table2` (table), `Columns3` (columns), `FileText` already imported (sub-page — reuse), `AtSign` (mention, if it needs a standalone icon anywhere in the palette). **This step is easy to forget — RESEARCH.md Pitfall 1 flags it explicitly.**

---

### `apps/workspaces/src/components/projectPage/ChecklistBlock.tsx` (component, CRUD)

**Analog:** `apps/workspaces/src/components/projectPage/KanbanBlock.tsx`

**Editable-list-with-add/remove pattern** (lines 21-39, add/remove/move item logic — adapt add/remove to checklist items, drop the move-left/right since checklist has no columns):
```typescript
const addCard = (colId: string, text: string) => {
  if (!text.trim()) return;
  setColumns(block.columns.map((c) =>
    c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), text: text.trim() }] } : c));
};
const removeCard = (colId: string, cardId: string) => {
  setColumns(block.columns.map((c) =>
    c.id === colId ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) } : c));
};
```
**"editable = !!onChange" dual view/edit mode** (line 18): reuse verbatim — same component renders read-only (`PageView`) or editable (`LivePageCanvas`) based on whether `onChange` is passed.

**Add-item inline input pattern** (lines 88-116, `AddCardInput` — clone directly for "add checklist item" / "add table row"):
```typescript
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
  // ...commit on Enter/blur, Escape cancels
}
```
Per UI-SPEC: checklist item row = `Square`/`CheckSquare` icon (16px, toggles done) + contentEditable text, checked → `line-through text-gray-400`, row spacing `gap-2 py-1`, placeholder "To-do".

---

### `apps/workspaces/src/components/projectPage/QuoteBlock.tsx` (component, CRUD)

**Analog:** `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` (direct clone per RESEARCH.md Pattern 1 and UI-SPEC's explicit note).

**Full pattern to clone** (entire file, 44 lines):
```typescript
const CONTAINER_CLASS =
  'flex items-start gap-2 rounded-xl border px-3 py-3 text-sm bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/40 dark:text-blue-300';

export function CalloutView({ block }: { block: CalloutBlock }) {
  return (
    <div className={CONTAINER_CLASS}>
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
    <div className={CONTAINER_CLASS}>
      <MessagesSquare className="w-4 h-4 mt-0.5 shrink-0" />
      <div ref={ref} contentEditable suppressContentEditableWarning
        className="flex-1 min-h-[1.25em] focus:outline-none"
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== block.text) onUpdate({ ...block, text: next });
        }} />
    </div>
  );
}
```
Per UI-SPEC, `QuoteView`/`QuoteEditor` use the SAME shape but a neutral (not blue) container: `border-l-4 border-gray-300 dark:border-slate-600 pl-3 py-1 italic text-gray-700 dark:text-gray-300`, no background — swap `MessagesSquare` for `Quote` icon (or drop the icon entirely per the border-l quote convention), empty placeholder "Empty quote".

---

### `apps/workspaces/src/components/projectPage/CodeBlock.tsx` (component, CRUD)

**Analog:** `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` (editor commit-on-blur shape) — but body uses a plain `<textarea>`/`<pre><code>` instead of `contentEditable` (monospace text is easier to manage as a controlled textarea), plus a native `<select>` for the language picker (no existing analog for the select — build from scratch using SlashMenu's `text-[11px]` label styling).

**Editor commit pattern to reuse** (same `useEffect`-sync + `onBlur`/`onChange` commit idiom as CalloutEditor above, lines 19-43) — swap `contentEditable div` for:
```typescript
<textarea
  value={block.code}
  onChange={(e) => onUpdate({ ...block, code: e.target.value })}
  className="w-full font-mono text-[13px] p-3 bg-transparent focus:outline-none resize-y"
  placeholder="// code"
/>
<select value={block.language} onChange={(e) => onUpdate({ ...block, language: e.target.value })}
  className="text-[11px] font-bold ..." >
  <option>Plain text</option>
  <option>JavaScript</option>
  {/* ... */}
</select>
```
Per UI-SPEC: container `bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700`, header strip has the language `<select>` top-right, body `font-mono text-[13px] p-3`. No syntax highlighting (Assumption A1 — plain `<pre><code>` + language label suffices for CONT-04).

---

### `apps/workspaces/src/components/projectPage/MediaBlocks.tsx` (component, CRUD, URL-only per D-05 discretion)

**Analog:** `apps/workspaces/src/components/projectPage/NewClientPageModal.tsx`'s dashed "Add" card pattern (referenced directly by UI-SPEC for the unconfigured state) + `CalloutBlock.tsx`'s commit-on-blur idiom for the URL input.

Read `NewClientPageModal.tsx` for the exact dashed-border button/card class names before implementing (not yet read in this pass — grep for `border-dashed` in that file to extract the exact Tailwind classes matching UI-SPEC's `border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-4`).

**Recommended shape per RESEARCH.md D-05/D-06/D-07 (cheapest defaults):**
- Image/File/Video: single `<input type="url">` committed via the same debounce-free `onBlur`/`onChange` idiom as CalloutEditor; configured state renders `<img>`/`<a>`/`<video>` tag directly from the URL (no upload plumbing, no `FileUploader`/`documents` API/migration needed).
- Bookmark/Embed: styled raw-URL card (favicon-style icon + hostname text via `new URL(url).hostname`), NOT a scraping endpoint — avoids the SSRF surface flagged in RESEARCH.md's Security Domain section.
- Video: plain `<video>` tag only (skip YouTube/Vimeo iframe detection, D-07 cheapest default) unless trivial to add a `youtube.com`/`vimeo.com` hostname check for an iframe embed.

**Error handling:** client-side URL shape validation only (`try { new URL(v) } catch { setError(...) }`), inline error text `text-xs text-red-500`, copy: "That doesn't look like a valid link — check the URL and try again." (from UI-SPEC Copywriting Contract).

**If real uploads are chosen instead (NOT the default recommendation):** see "No Analog Found" section below — this path requires a new migration and is NOT a simple pattern-copy.

---

### `apps/workspaces/src/components/projectPage/TableBlock.tsx` (component, CRUD)

**Analog:** `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` (add/remove-row logic pattern, lines 21-39 — same immutable-array-update shape, applied to `rows: string[][]` instead of `columns[].cards[]`).

**Grid rendering per UI-SPEC:** `border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden`; header row `bg-gray-50 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-gray-400`; body cells `text-sm px-2.5 py-1.5 border-t border-gray-100 dark:border-slate-800` (approved spacing exception, see UI-SPEC). Each cell is `contentEditable` (same idiom as `CalloutEditor`'s `ref`+`onBlur` commit) or a plain `<input>`; header cells default to "Column 1"/"Column 2" placeholders. "No rows yet" empty state.

---

### `apps/workspaces/src/components/projectPage/ToggleBlock.tsx` (component, CRUD + event-driven — NEW ground)

**Analog:** No exact precedent (RESEARCH.md confirms no nesting exists anywhere). Closest partial analogs:
1. `apps/workspaces/src/components/projectPage/PageTree.tsx` (lines 42-51, 71-74) for the expand/collapse chevron mechanics:
```typescript
const [expanded, setExpanded] = useState(true);
// ...
<button onClick={() => setExpanded((v) => !v)} className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
</button>
{hasChildren && expanded && (
  <PageTree pages={pages} projectId={projectId} parentId={page.id} depth={depth + 1} .../>
)}
```
Note UI-SPEC differs slightly: toggle's `collapsed` boolean is PERSISTED in `PageConfig` JSON (not just client state) — so the pattern must call `onUpdate({...block, collapsed: !block.collapsed})` instead of local `useState`.

2. `apps/workspaces/src/components/projectPage/KanbanBlock.tsx`'s add/remove-card pattern (lines 21-29) for the nested-children add/remove logic, applied to `children: PageBlock[]` instead of `cards[]`.

**Nested mini-canvas (genuinely new):** for each child in `block.children`, call `pageBlockRegistry.renderEditor(child, ctx, (updated) => onUpdate({...block, children: block.children.map(c => c.id===updated.id?updated:c)}))` (or the render/edit dispatch shape already used in `registry.tsx`'s `entries`) — do NOT reuse `LivePageCanvas` wholesale (per RESEARCH.md Anti-Patterns, it assumes a 6-col grid + `@dnd-kit` `SortableContext` that will collide). Build a purpose-specific ordered-list renderer with a "+ Add block" ghost button (style-clone `KanbanBlock.tsx`'s `AddCardInput` open button, lines 92-96) that opens a slash-style menu filtered via the new `isNestableItem()`.

**No drag-reorder inside children** (per D-01/Pitfall 3/A4) — optional up/down `ChevronUp`/`ChevronDown` 12px buttons only, styled `text-gray-300 hover:text-gray-500` (same idiom as `KanbanBlock.tsx`'s `moveCard` left/right buttons, lines 66-71).

**UI-SPEC indentation:** `pl-5` + `border-l border-gray-100 dark:border-slate-800` rail — this is the new precedent for indentation (shared by columns too).

---

### `apps/workspaces/src/components/projectPage/ColumnsBlock.tsx` (component, CRUD — NEW ground)

**Analog:** same as ToggleBlock — shares the nested mini-canvas mechanism (per D-01's single-mechanism choice). Fixed 2-lane `grid grid-cols-2 gap-4` (D-04), each lane `bg-gray-50/50 dark:bg-slate-800/30 rounded-lg p-2` inset, "+ Add block" ghost button per empty lane cloning `KanbanBlock.tsx`'s "+ Add card" styling (lines 92-96).

---

### `apps/workspaces/src/components/projectPage/SubPageBlock.tsx` (component, request-response)

**Analog:** `apps/workspaces/src/components/projectPage/PageTree.tsx`'s `PageRow` (static row + navigate shape) + `apps/workspaces/src/app/projects/[id]/page.tsx`'s `addSubPage()` (creation call, lines 69-77).

**Sub-page creation call to reuse verbatim:**
```typescript
// Source: apps/workspaces/src/app/projects/[id]/page.tsx:69-77
async function addSubPage(parentPageId: string) {
  setAddingUnder(parentPageId);
  try {
    const created = await createPage.mutateAsync({ title: 'Untitled', parent_page_id: parentPageId });
    router.push(`/projects/${id}/pages/${created.id}`);
  } finally {
    setAddingUnder(null);
  }
}
```
For the BLOCK's "insert sub-page" flow: call the same `projectsApi.createPage(projectId, { parent_page_id: currentPageId, title: 'Untitled' })` mutation, then instead of `router.push`, construct a `SubPageBlock { kind: 'sub-page', pageId: created.id, title: created.title }` and insert it via the slash-menu's `create()`/insert-below path (see `LivePageCanvas.tsx`'s `handleSlashSelect`).

**Static row render pattern** (`PageTree.tsx` lines 56-59):
```typescript
<Link href={`/projects/${projectId}/pages/${page.id}`} className="min-w-0 flex items-center gap-2 flex-1">
  {page.is_default && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
  <span className="font-semibold text-gray-900 dark:text-white truncate text-sm">{page.title}</span>
</Link>
```
Per UI-SPEC: `FileText` icon (16px) + bold title + `ExternalLink` 12px icon on hover, `rounded-lg border border-gray-200 dark:border-slate-700 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/60` — click anywhere navigates (new tab, per D-13/crossAppUrl convention if cross-app; same-app `Link`/`router.push` if within workspaces). No live content preview — static title+icon row only.

---

### `apps/workspaces/src/components/projectPage/MentionMenu.tsx` (NEW, component, event-driven)

**Analog:** `apps/workspaces/src/components/projectPage/SlashMenu.tsx`'s `SlashMenuPanel` — exact visual/structural clone per UI-SPEC.

**Container + grouped-list pattern to clone** (lines 28-95, whole `SlashMenuPanel` function):
```typescript
return createPortal(
  <div className="fixed z-50 w-72 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
    style={{ left: position.left, top: position.top, transform: position.openUp ? 'translateY(-100%)' : undefined }}
    onMouseDown={(e) => e.preventDefault()}>
    <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
      {items.length === 0 ? (
        <p className="px-3 py-4 text-xs text-gray-400 text-center">No matching blocks.</p>
      ) : (
        items.map((item, i) => {
          const groupStart = i === 0 || items[i - 1].group !== item.group;
          return (
            <div key={item.id}>
              {groupStart && <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{GROUP_LABEL[item.group]}</p>}
              <button data-index={i} onMouseEnter={() => onHover(i)} onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left ${i === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                {/* icon + title + description */}
              </button>
            </div>
          );
        })
      )}
    </div>
  </div>,
  document.body,
);
```
Replace `GROUP_LABEL: Record<PageBlockGroup, string>` (line 26) with a mention-specific `MENTION_GROUP_LABEL: Record<'person'|'page'|'date', string> = { person: 'People', page: 'Pages', date: 'Dates' }`. Empty-state copy per UI-SPEC: "No matching people, pages, or dates."

---

### `apps/workspaces/src/components/projectPage/EditableRichText.tsx` (modify — add `@` trigger)

**Analog:** itself — clone the existing `/`-trigger two-phase mechanism verbatim, transposed to `@`.

**Exact mechanism to clone** (lines 137-147, keydown pre-check):
```typescript
if (e.key === '/' && slashItems && onSlashSelect) {
  const caret = caretPoint();
  if (!caret) return;
  if (caret.node.nodeType === Node.TEXT_NODE && caret.offset > 0) {
    const prev = (caret.node.textContent ?? '')[caret.offset - 1];
    if (prev && !/[\s ]/.test(prev)) return;
  }
  pendingSlash.current = true;
}
```
And the input-event confirmation (lines 155-169) — needs a parallel `pendingMention` ref + `MentionState` (mirrors `SlashState`, lines 21-26) and its own `mention`/`setMention` state, with `MentionMenuPanel` swapped in for `SlashMenuPanel` in the render (lines 208-216).

**Selection/commit insertion differs from slash:** instead of replacing the whole block (as `selectItem`, lines 104-122, does for slash), mention selection inserts an inline `<span>` node at the trigger position via `range.deleteContents()` + `range.insertNode(spanEl)`, then continues editing in the same block (no `onSlashSelect`-style block transform).

**Critical DOMPurify fix required (RESEARCH.md Pitfall 4):** the `commit()` function (lines 81-86) currently calls bare `DOMPurify.sanitize(...)` with default options — this WILL strip `data-mention-type`/`data-mention-id` attributes on the next save/reload. Must pass an explicit config everywhere mention HTML is sanitized:
```typescript
// Current (line 82) — must be updated for mention support:
const raw = ref.current ? DOMPurify.sanitize(ref.current.innerHTML) : html;
// Needs:
const raw = ref.current ? DOMPurify.sanitize(ref.current.innerHTML, {
  ADD_ATTR: ['data-mention-type', 'data-mention-id'],
}) : html;
```
Same fix needed in `selectItem`'s sanitize call (line 118) if mention insertion reuses that path, and in whatever read-only renderer displays committed rich-text/list HTML (`RichTextView`/`ListView` in `pageBlockViews.tsx` — not yet read, flag for planner to check for a second sanitize call-site there).

---

## Shared Patterns

### Registry extensibility (4-step contract + undocumented 5th step)
**Source:** `apps/workspaces/src/lib/projectPage/blocks.ts` lines 8-11 (documented 3 steps) + `apps/workspaces/src/components/projectPage/icon.tsx` (undocumented 4th step) + new `nestable` flag (5th, new-this-phase concern).
**Apply to:** every one of the 11 new block kinds.
Steps: (1) union member in `blocks.ts`, (2) `PAGE_BLOCK_REGISTRY` entry in `blocks.ts`, (3) renderer/editor component + `entry()` wiring in `registry.tsx`, (4) icon in `icon.tsx`'s `MAP`, (5) `nestable` flag set correctly for content-group kinds, `EXTRA_KEYWORDS` entry in `slashMenu.ts`.

### contentEditable commit idiom (sync-while-unfocused, commit-on-blur)
**Source:** `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` lines 22-26, 36-39
**Apply to:** QuoteBlock, ChecklistBlock item text, TableBlock cells, ToggleBlock title, any new block with free-text content.
```typescript
useEffect(() => {
  const el = ref.current;
  if (!el || document.activeElement === el) return;
  if ((el.textContent ?? '') !== block.text) el.textContent = block.text;
}, [block.text]);
// ...
onBlur={() => {
  const next = (ref.current?.textContent ?? '').trim();
  if (next !== block.text) onUpdate({ ...block, text: next });
}}
```

### Dual view/edit mode via optional `onChange`
**Source:** `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` line 18
**Apply to:** ChecklistBlock, TableBlock, ToggleBlock, ColumnsBlock (any block that needs different read-only vs. editable affordances in one component).
```typescript
const editable = !!onChange;
```

### Immutable array update for add/remove/reorder
**Source:** `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` lines 21-39
**Apply to:** ChecklistBlock items, TableBlock rows, ToggleBlock/ColumnsBlock children.

### Slash/mention popover container + grouped list
**Source:** `apps/workspaces/src/components/projectPage/SlashMenu.tsx` lines 46-94 (`SlashMenuPanel`)
**Apply to:** `MentionMenu.tsx` (new) — identical container class, grouped-list-with-header pattern, `createPortal` to `document.body`, `onMouseDown={(e) => e.preventDefault()}` to keep focus in the host contentEditable.

### Two-phase trigger detection (keydown pre-check → input-event confirm)
**Source:** `apps/workspaces/src/components/projectPage/EditableRichText.tsx` lines 124-183
**Apply to:** the new `@`-mention trigger in the same file.

### DOMPurify sanitize-on-commit
**Source:** `apps/workspaces/src/components/projectPage/EditableRichText.tsx` line 82 (default config — must be extended for mention support, see above)
**Apply to:** every contentEditable-backed block's commit path (quote, checklist item text, table cells, toggle title) — none of the OTHER new blocks need the `ADD_ATTR` extension (only mention-bearing rich-text/list do), but all should call `DOMPurify.sanitize(...)` before persisting HTML, consistent with the existing convention.

### Sub-page creation (reuse verbatim, no new endpoint)
**Source:** `apps/workspaces/src/app/projects/[id]/page.tsx` lines 69-77, backed by `apps/workspaces/src/lib/api/projects.api.ts`'s `createPage` (line 109)
**Apply to:** `SubPageBlock.tsx`'s insert-new-child-page action.

### Company people list (reuse verbatim, no new endpoint)
**Source:** `apps/workspaces/src/lib/hooks/useTeam.ts` lines 24-32, backed by `apps/workspaces/src/lib/api/team.api.ts`'s `teamApi.list()`
**Apply to:** `mentionMenu.ts`'s `@person` data source.

### Cross-app navigation
**Source:** `packages/ui/src/appUrls.ts` lines 33-36 (`crossAppUrl`)
**Apply to:** `@page`-mention click-navigate and sub-page-block click-navigate IF the target page/app differs from the current app context (same-app navigation should just use Next.js `Link`/`router.push` as `PageTree.tsx` does).
```typescript
export function crossAppUrl(app: VectraApp, path = '/'): string {
  const base = appUrls[app].replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
```

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Nested mini-canvas renderer (shared by ToggleBlock/ColumnsBlock) | component | CRUD, event-driven | No block has ever had children in this codebase (RESEARCH.md confirms — checked mini-program blocks too, its `'columns'` kind is an unrelated data-table column selector). The `LivePageCanvas.tsx` full-grid+dnd-kit approach is explicitly an anti-pattern here (SortableContext collision risk) — must be built fresh as a simpler ordered-list-with-insert-only component. Use `KanbanBlock.tsx`'s add/remove idiom + `PageTree.tsx`'s expand/collapse idiom as the nearest partial analogs (see Pattern Assignments above), but there is no single file to copy wholesale. |
| Real-upload media path (if D-05 discretion selects uploads instead of URL-only) | service/migration | file-I/O | `packages/data/src/documents/FileUploader.tsx` + `/api/v1/documents` exists but requires extending `DocumentSubject`, the Express `ALLOWED_SUBJECTS` guard, AND a new SQL migration (`025_...sql`) to widen the Postgres `documents_subject_check` CHECK constraint (`database/migrations/002_realtime_and_documents.sql`) — this is a schema change, not a pattern-copy. Recommend URL-only (see MediaBlocks pattern above) to avoid this path entirely per RESEARCH.md's cost analysis. |
| Bookmark/embed link-preview scraping endpoint (if D-06 discretion selects real scraping) | controller/service | request-response (external fetch) | No existing endpoint fetches arbitrary external URLs server-side anywhere in `apps/api`. Would be new backend surface with SSRF-mitigation requirements (scheme allowlist, private-IP-range rejection, timeout, response-size cap) — not a pattern-copy. Recommend the styled raw-URL card default (no server fetch) to avoid this entirely. |

## Metadata

**Analog search scope:** `apps/workspaces/src/lib/projectPage/`, `apps/workspaces/src/components/projectPage/`, `apps/workspaces/src/lib/api/`, `apps/workspaces/src/lib/hooks/`, `packages/ui/src/appUrls.ts`, `apps/workspaces/src/app/projects/[id]/page.tsx`
**Files scanned:** blocks.ts, registry.tsx, slashMenu.ts, icon.tsx, CalloutBlock.tsx, KanbanBlock.tsx, SlashMenu.tsx, EditableRichText.tsx, PageTree.tsx, projects.api.ts, useTeam.ts, appUrls.ts, projects/[id]/page.tsx, LivePageCanvas.tsx (targeted grep)
**Pattern extraction date:** 2026-07-13
