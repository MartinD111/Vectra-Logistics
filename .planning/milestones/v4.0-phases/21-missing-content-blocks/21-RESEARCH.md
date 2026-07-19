# Phase 21: Missing Content Blocks - Research

**Researched:** 2026-07-13
**Domain:** Notion-style block editor extension (React/Next.js, contentEditable, flat JSONB block array → introducing first-ever nesting)
**Confidence:** HIGH (architecture/code paths directly read from repo) / MEDIUM (nesting UI pattern, since no precedent exists) / LOW (media upload + mention data-source specifics, since partly novel)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-02:** Nesting is capped at one level deep — a toggle or column may NOT contain another toggle or another columns block. Hard constraint.
- **D-03:** Only content-group blocks (text, heading, checklist, quote, code, media, table, sub-page, etc.) may be inserted inside a toggle or column — widget blocks (kanban, kpi-grid, chart, crm-clients, and similar data widgets) are NOT insertable as nested children. The slash menu inside a nested context must filter to content-group items only.
- **D-10:** Clicking a rendered mention navigates: `@person` -> their profile/detail (or a hover card), `@page` -> that page (new tab, following the existing `crossAppUrl`/link-navigation convention), `@date` -> no action (styled text only). Locked, not discretion.
- **D-12:** Inserting a sub-page block via slash menu always creates a brand-new empty child page (reusing `PageTree.tsx`'s existing "Add sub-page" action and `parent_page_id` nesting) and inserts a link block to it. No "link an existing page" picker in this phase.
- **D-13:** The sub-page link block renders as a static title + icon row (page title + a page icon, click navigates) — no live content preview to keep in sync.
- **Mechanism note:** `EditableRichText.tsx`'s existing "/" slash-trigger detection (two-phase keydown pre-check + input-event confirmation, tracking the trigger node/offset for a live query and range-replace on selection — see `EditableRichText.tsx:137-178`) is the pattern to follow for "@" detection; no new architectural approach is needed for the trigger itself, only a different query data source (people/pages/dates) and a different popover.
- **Block nesting D-01:** Blocks are currently a strictly flat array (`PageContent.blocks: PageBlock[]`) — no block has ever had children. Toggle and multi-column layout are the first blocks to introduce nesting. Claude has discretion on whether both share one `children: PageBlock[]` mechanism or are modeled differently, as long as the result is simple to render/edit.

### Claude's Discretion
- **D-01:** Whether toggle and columns share one `children: PageBlock[]` mechanism or are modeled differently, as long as simple to render/edit.
- **D-04:** Column count for the multi-column layout block (fixed 2/3-column choice vs. flexible add/remove lane) — pick whichever satisfies CONT-07 with the least new UI surface.
- **D-05:** Upload vs. URL-only for image/file/video blocks. If real uploads, reuse `packages/data`'s `FileUploader` + `/api/v1/documents` pipe by extending `DocumentSubject` (currently `company | driver | vehicle | shipment | booking`) rather than building new upload plumbing. If URL-only, follow the same pattern as bookmark/embed.
- **D-06:** Bookmark/embed link-preview behavior (real og:title/og:image scraping via a new backend endpoint vs. a styled raw-URL card) — note the SSRF security tradeoff if a scraping endpoint is chosen.
- **D-07:** Video block's YouTube/Vimeo embed support (iframe embed for known platforms, falling back to `<video>` for direct file URLs) vs. plain `<video>` tag only — pick whichever is cheapest while covering CONT-05.
- **D-08:** File-size/type limits for any new upload path must reuse whatever `FileUploader` already enforces — do not invent new, tighter limits.
- **D-09:** Whether to ship all three mention types (person/page/date) in this phase or person-only with page/date deferred — lean toward shipping all three unless cost is clearly disproportionate; if deferring, record explicitly as a deferred idea.
- **D-11:** Whether `@mention` fires a notification/activity-log entry to the mentioned person — reuse existing notification/chat plumbing if cheap; otherwise ship inline UI/resolution only, treat notification wiring as a follow-up.

### Deferred Ideas (OUT OF SCOPE)
- **Synced blocks** (Loop's "same content mirrored in multiple places") — explicitly called out in `docs/specs/core/workspace-blocks.md` §5 item 10 as higher-effort/later, and not in CONT-01..09. Not in scope for Phase 21.
- **Full CRDT/multi-caret co-editing** — explicitly out of scope per the spec §7; last-write-wins + realtime refresh is the stated first target for a later phase.
- **Link-an-existing-page picker for the sub-page block** — deferred by decision D-12; only "create new" ships this phase. If a future phase wants it, `PageTree.tsx` already has the data needed for a picker.
- **@mention notifications**, if not implemented under D-11's discretion — should be picked up as a natural follow-up once the base mention UI exists.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| CONT-01 | User can add a checklist/to-do block with checkable items | Standard flat-block addition pattern (Pattern 1); reuses contentEditable + dompurify approach from `ListBlock`/`CalloutBlock` |
| CONT-02 | User can add a collapsible toggle block containing child blocks | New nesting pattern (Pattern 2) — `children: PageBlock[]`, cut-down nested mini-canvas, no dnd-kit reorder (Pitfall 3) |
| CONT-03 | User can add a quote block | Standard flat-block addition pattern (Pattern 1), direct clone of `CalloutBlock.tsx`'s editor shape |
| CONT-04 | User can add a fenced code block with language selection | Standard flat-block addition pattern; language picker via native `<select>`, optional syntax highlighting flagged as Assumption A1 |
| CONT-05 | User can add media blocks (image, file, video, bookmark, embed) | Architectural Responsibility Map splits URL-only (no backend) vs. real-upload (migration required, Pitfall 2) paths; recommend URL-only default (Open Question 2) |
| CONT-06 | User can add a simple inline table block (distinct from a collection-view table) | Standard flat-block addition pattern; simple grid editor, no relation to Phase 22's `data_collections` |
| CONT-07 | User can add a multi-column layout block | New nesting pattern (Pattern 2), shares mechanism with CONT-02 per D-01; column count is Assumption A3 |
| CONT-08 | User can add an inline sub-page link block | Reuses `projectsApi.createPage` + `PageTree.tsx`'s existing "Add sub-page" flow verbatim (Don't Hand-Roll table) |
| CONT-09 | User can @mention a person/page/date inline in rich text | Clone of "/"-trigger mechanism (Pattern 3); `teamApi.list()` for person (no new endpoint), `projectsApi.listPages` for page (scope caveat, Open Question 1), pure client-side for date |
</phase_requirements>

## Summary

Phase 21 is a pure additive extension of the existing `PageBlock` discriminated-union +
`PAGE_BLOCK_REGISTRY` + `pageBlockRegistry` (Workspace Engine) system in
`apps/workspaces/src/lib/projectPage/`. Every one of CONT-01..09's new kinds follows the
same 4-step recipe already established by `callout`/`kanban`: add a union member in
`blocks.ts`, add a renderer (+ optional editor) component, register both in
`PAGE_BLOCK_REGISTRY` and `registry.tsx`'s `entries` map, and add its lucide icon to the
hand-maintained `MAP` in `components/projectPage/icon.tsx` (a 4th step the `blocks.ts`
"extensibility contract" comment omits — a real gotcha, see Pitfalls).

The one genuinely new piece of ground is **nesting**: today `PageContent.blocks` (well,
`PageConfig.blocks`) is a strictly flat array, and the top-level canvas
(`LivePageCanvas.tsx`) drives full drag-and-drop, spans, and per-block chrome over that
flat array via `@dnd-kit`. Toggle (CONT-02) and multi-column (CONT-07) both need a
`children: PageBlock[]`-shaped block that renders its own miniature block list. Per
CONTEXT.md D-01/D-02/D-03, nesting is capped at one level, shares one mechanism, and
only "content-group" blocks may nest — but the existing `PageBlockGroup` (`'content' |
'widget' | 'soon'`) is used today for a *different* purpose (which items may
transform-in-place under the slash menu), so a new/separate `nestable: boolean` (or
similar) flag is likely needed on `PageBlockDef`/`WorkspaceBlockPlugin` rather than
reusing `group` — media, table and sub-page are explicitly nestable per D-03 but are
naturally `'widget'`-grouped today (they insert standalone, they don't transform an
empty text block in place).

The `@`-mention trigger (CONT-09) has a near-identical mechanical twin already shipped:
`EditableRichText.tsx`'s `/`-slash detection (two-phase keydown pre-check + input-event
confirmation, tracked node/offset, range-delete-and-replace on selection). The same
approach transposes directly to `@`, with a different query data source and popover.
The company-wide people list already exists via `teamApi.list()` / `useTeam()` (`GET
/api/v1/team`) — no new backend endpoint is needed for `@person`. There is, however, **no
existing cross-project page search** (only `projectsApi.listPages(projectId)`, scoped to
one project) — `@page` mention will need to decide its search scope (current project's
pages only vs. company-wide), which is not resolved by any existing pattern and should be
flagged to the planner as an open question / cheapest-default decision.

Media blocks' "real upload" path (D-05) is NOT a drop-in reuse: the `documents` table has
a hard Postgres **`CHECK (subject IN ('company','driver','vehicle','shipment','booking'))`**
constraint (migration `002_realtime_and_documents.sql`), and the Express route additionally
guards with its own `ALLOWED_SUBJECTS` `Set`. Adding a new subject value (e.g.
`'page-block'`) for page-embedded uploads genuinely requires a new migration (`025_...sql`,
per the project's already-decided next migration number) to widen the CHECK constraint —
this is a real schema change, not just a TS type edit, and must be scoped into the plan if
D-05 chooses real uploads.

**Primary recommendation:** Implement CONT-01/03/04/06 (checklist, quote, code, table) and
the five media kinds as flat, non-nesting blocks first (cheapest, highest-value, no new
architecture) — each is the standard 4-step registry recipe. Implement toggle + columns
(CONT-02, CONT-07) as the two nesting blocks, sharing one `children: PageBlock[]` field and
a shared lightweight nested-editor component (no drag-reorder inside nesting, given the cap
is one level and the user explicitly favored the cheapest option). Implement sub-page
(CONT-08) reusing `projectsApi.createPage()` + a static title/icon renderer. Implement
`@mention` (CONT-09) by cloning the slash-trigger mechanism in `EditableRichText.tsx` for
`@`, backed by `teamApi.list()` for people and `projectsApi.listPages()` (current project
scope) for pages, with `@date` as a plain native `<input type="date">`-free text-token
insertion (styled span, no navigation, per D-10).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| New block kinds (checklist, toggle, quote, code, table, columns) | Frontend (Browser/client component) | — | Purely `PageConfig` JSONB shape + React renderer; no server logic, matches every existing content block (heading, list, divider, callout) |
| Media blocks (image/file/video/bookmark/embed), URL-only variant | Frontend (Browser/client component) | — | If URL-only (D-05 discretion), block just stores a URL string — no backend involvement |
| Media blocks, real-upload variant | Frontend (Browser) | API/Backend (`/api/v1/documents`) + Database (`documents` table CHECK constraint) | Requires extending `DocumentSubject`, `ALLOWED_SUBJECTS`, and a migration if real uploads are chosen |
| Bookmark/embed link-preview scraping (if chosen, D-06) | API/Backend (new endpoint) | — | Fetching arbitrary external URLs server-side is an SSRF-risk surface; must not run client-side |
| Sub-page block (create + link) | Frontend (Browser) | API/Backend (`projectsApi.createPage`, already exists) | Reuses existing `project_pages` create endpoint + `parent_page_id`; zero new backend surface |
| `@mention` — person | Frontend (Browser) | API/Backend (`GET /api/v1/team`, already exists) | Existing company-scoped user list; no new endpoint |
| `@mention` — page | Frontend (Browser) | API/Backend (`projectsApi.listPages`, already exists, project-scoped only) | No cross-project page search exists today — scope decision needed |
| `@mention` — date | Frontend (Browser) | — | Pure client-side text token, no data fetch, no navigation (D-10) |
| `@mention` notification/activity-log (if wired, D-11) | API/Backend (`recordEvent` / notifications table) | — | Existing `activity_events` + `notifications` tables and `NotificationBell`/`useNotifications` plumbing already exist |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 / Next.js 14.0.3 | pinned (repo) | Component model for every new block renderer/editor | Existing stack, no alternative considered |
| dompurify | 3.3.3 (repo) | Sanitize contentEditable HTML for quote/table/toggle text content, same as rich-text/list today | Already used by `EditableRichText.tsx`; reuse-over-rebuild constraint |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 6.3.1 / 10.0.0 (repo) | Top-level block reordering (unchanged); NOT proposed for use inside nested toggle/column children (see Architecture Patterns) | Already the project's only DnD library |
| lucide-react | 0.294.0 (repo) | New block icons (CheckSquare, ChevronRight/Triangle, Quote, Code2, Image, File, Video, Bookmark, Frame, Table2, Columns3, FileText, AtSign) | Existing icon library; icons must additionally be added to `icon.tsx`'s hand-maintained `MAP` |

**Version verification:** All versions above are read directly from this repo's existing
`package.json`/CLAUDE.md tech-stack listing — no new package installs are required for
CONT-01..08. `[VERIFIED: package.json / codebase grep]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new required for CONT-01/02/03/04/06/07/08/09 (text/table/toggle/columns/mention/sub-page) | — | — | All buildable with existing contentEditable + dompurify pattern |
| A syntax-highlighting library (e.g. `prismjs` or `highlight.js`) | not installed | Optional: colorized code block rendering for CONT-04 | Only if D-04's "language picker" is expected to also render syntax highlighting, not just tag the language. `[ASSUMED — not in CONTEXT.md, treat as Claude's discretion since not explicitly requested; a plain `<pre><code>` + language label satisfies CONT-04's literal wording without a new dependency]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `@`-trigger clone of the `/`-trigger mechanism | A rich-text/mention library (tiptap, slate, prosemirror-mentions) | Project's own code comment in `EditableRichText.tsx` explicitly states "Deliberately no editor library" — introducing one now would be a major, out-of-scope architecture change and contradicts the existing pattern the user's canonical_refs point to as the mechanism to follow |
| Real file upload for media blocks | URL-only (paste a link) media blocks | Zero backend/migration work; ships CONT-05 fully. This is explicitly Claude's discretion (D-05) — given the reuse path requires a genuine DB migration (see below), URL-only is the cheaper default unless the user's Discussion clearly wants real uploads |
| A new backend bookmark/embed scraping endpoint | Styled raw-URL card (no scraping) | Scraping is a new SSRF-risk surface requiring URL validation/allowlisting; a static card (favicon + hostname + optional manual title) satisfies CONT-05's "bookmark" wording without new backend risk |

**Installation:**
```bash
# No new packages required for the default (cheapest) path through D-05/D-06/D-07.
# Only if syntax highlighting is desired for the code block (optional, discretionary):
npm install prismjs --workspace=apps/workspaces
```

## Package Legitimacy Audit

No new external packages are required for the recommended (cheapest) implementation
path — all CONT-01..09 requirements are achievable with libraries already in the
dependency tree (`dompurify`, `@dnd-kit/*`, `lucide-react`). If the planner or a future
discretion choice adds `prismjs`/`highlight.js` for code-block syntax highlighting, run
the Package Legitimacy Gate at that time.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages evaluated — none required)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User types "/" or "@" in EditableRichText (contentEditable div)
        │
        ▼
Two-phase trigger detection (keydown pre-check → input-event confirm)
        │
        ├─ "/" ──► buildSlashMenuItems() ──► filterSlashMenuItems(query)
        │              │                         │
        │              ▼                         ▼
        │        PAGE_BLOCK_REGISTRY      SlashMenuPanel (popover)
        │              │                         │
        │              ▼                         ▼
        │        item.create() ──────► LivePageCanvas.handleSlashSelect()
        │                                         │
        │                              transform-in-place (empty host,
        │                              content-group item) OR insert-below
        │
        └─ "@" (NEW) ──► buildMentionItems(query, type)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              teamApi.list  projectsApi   client-side
              (person)      .listPages    date parser
                             (page, this-      (no fetch)
                             project scope)
                              │
                              ▼
                    MentionMenuPanel (popover, mirrors SlashMenuPanel)
                              │
                              ▼
                    insert <span data-mention-type data-mention-id>
                    into contentEditable HTML (sanitized by DOMPurify
                    with an allowlisted data-* attribute)
                              │
                              ▼
                    onClick (event-delegated) ──► navigate
                    (crossAppUrl / same-app router.push) OR no-op (date)

Toggle / Columns block (NEW nesting)
        │
        ▼
ToggleBlock { children: PageBlock[] }  /  ColumnsBlock { columns: PageBlock[][] }
        │
        ▼
Nested mini-canvas component (NOT the full LivePageCanvas — no dnd-kit reorder,
simpler +/insert-only UI) renders each child via
pageBlockRegistry.renderEditor(child, ctx, onChildUpdate)
        │
        ▼
Nested slash menu filtered to nestable-only items (NEW flag, not `group`)
```

### Recommended Project Structure
```
apps/workspaces/src/lib/projectPage/
├── blocks.ts              # add ChecklistBlock, ToggleBlock, QuoteBlock, CodeBlock,
│                           #   ImageBlock/FileBlock/VideoBlock/BookmarkBlock/EmbedBlock,
│                           #   TableBlock, ColumnsBlock, SubPageBlock — union members +
│                           #   PAGE_BLOCK_REGISTRY entries. Add `nestable?: boolean` to
│                           #   PageBlockDef for the toggle/column child filter.
├── registry.tsx            # one `entry(...)` call per new kind
├── slashMenu.ts             # EXTRA_KEYWORDS entries for each new kind; add
│                           #   `isNestableItem()` alongside existing `isContentItem()`
└── mentionMenu.ts (NEW)     # mirrors slashMenu.ts but for "@" — buildMentionItems(),
                            #   filterMentionItems(), backed by teamApi/projectsApi

apps/workspaces/src/components/projectPage/
├── icon.tsx                 # add every new lucide icon to MAP (do not forget this step)
├── ChecklistBlock.tsx (NEW)  # view + editor (checkbox items, add/remove item)
├── ToggleBlock.tsx (NEW)     # view (expand/collapse) + editor (nested mini-canvas)
├── QuoteBlock.tsx (NEW)      # view + editor, same contentEditable pattern as CalloutBlock.tsx
├── CodeBlock.tsx (NEW)       # view (pre/code + language badge) + editor (textarea +
│                             #   language <select>)
├── MediaBlocks.tsx (NEW)     # ImageBlockView/Editor, FileBlockView/Editor,
│                             #   VideoBlockView/Editor, BookmarkBlockView/Editor,
│                             #   EmbedBlockView/Editor — grouped in one file since they
│                             #   share a URL-input-first UI shape
├── TableBlock.tsx (NEW)      # simple inline grid editor (add row/col, per-cell contentEditable)
├── ColumnsBlock.tsx (NEW)    # 2/3-lane layout, nested mini-canvas per lane
├── SubPageBlock.tsx (NEW)    # static title+icon row, click-to-navigate
├── MentionMenu.tsx (NEW)     # popover mirroring SlashMenu.tsx's SlashMenuPanel
└── EditableRichText.tsx      # extend with "@" trigger detection (mirrors "/" logic)
```

### Pattern 1: Standard flat block addition (checklist, quote, code, table, media, sub-page)
**What:** Add union member → renderer/editor → registry entry → icon.
**When to use:** Every CONT requirement except toggle (CONT-02) and columns (CONT-07).
**Example:**
```typescript
// Source: apps/workspaces/src/lib/projectPage/blocks.ts (existing CalloutBlock pattern)
export interface QuoteBlock extends PageBlockBase {
  kind: 'quote';
  text: string;
}
// registry.tsx
'quote': entry('quote',
  ({ block }) => <QuoteView block={block as QuoteBlock} />,
  ({ block, onUpdate }) => <QuoteEditor block={block as QuoteBlock} onUpdate={onUpdate} />,
),
```

### Pattern 2: Nested-children block (toggle, columns) — NEW ground
**What:** A block whose data shape holds `PageBlock[]` (or `PageBlock[][]` for columns),
rendered by a cut-down mini-canvas: no `@dnd-kit` sortable context, no cross-block-width
span controls — just an ordered list with "+ add block" (filtered to nestable kinds) and
per-child delete. This deliberately does NOT reuse `LivePageCanvas` wholesale (that
component assumes a 6-col grid + full DnD + settings popover, none of which the user asked
for inside a toggle/column — D-01/D-04 explicitly favor the cheapest option).
**When to use:** CONT-02 (toggle) and CONT-07 (columns) only. Reject nesting a toggle/column
inside another toggle/column at both the data layer (`create()` for nested items filters
these two kinds out) and the UI layer (nested slash menu never includes them) — enforces D-02.
**Example:**
```typescript
// Source: derived from existing PageConfig shape, no direct precedent in repo
export interface ToggleBlock extends PageBlockBase {
  kind: 'toggle';
  title: string;
  collapsed: boolean;
  children: PageBlock[];
}
export interface ColumnsBlock extends PageBlockBase {
  kind: 'columns';
  columns: PageBlock[][]; // fixed-length array (2 or 3, per D-04 discretion)
}
```

### Pattern 3: `@`-mention trigger (clone of `/`-trigger)
**What:** Duplicate the two-phase detection in `EditableRichText.tsx:124-183`
(`pendingSlash` ref → `handleKeyDown` marks intent on `/` → `handleInput` confirms via
caret-adjacent-character check → tracks `{node, offset}` → live query via
substring-after-trigger → `Enter`/`Tab` commits via range-delete-and-replace). For `@`,
track a second `pendingMention` ref and `MentionState`, with its own popover
(`MentionMenuPanel`) instead of `SlashMenuPanel`. Selecting a mention item inserts an
inline `<span contenteditable="false" data-mention-type="person" data-mention-id="...">`
node instead of replacing the whole block (mentions live inside a `rich-text`/`list`/
other content block's HTML, not as their own `PageBlockKind`).
**When to use:** CONT-09 only.
**Example:**
```typescript
// Source: apps/workspaces/src/components/projectPage/EditableRichText.tsx:137-147 (existing "/" detection)
if (e.key === '@' && mentionEnabled) {
  const caret = caretPoint();
  if (!caret) return;
  if (caret.node.nodeType === Node.TEXT_NODE && caret.offset > 0) {
    const prev = (caret.node.textContent ?? '')[caret.offset - 1];
    if (prev && !/\s/.test(prev)) return; // same "only after whitespace" rule as "/"
  }
  pendingMention.current = true;
}
```

### Anti-Patterns to Avoid
- **Reusing `PageBlockGroup` (`'content'|'widget'|'soon'`) to gate nesting:** it already
  means something else (whether a slash-menu item can transform an empty text block in
  place). Overloading it will silently break `isContentItem()`'s existing behavior for
  every current content block. Add a separate `nestable` flag/field instead.
- **Reusing `LivePageCanvas` unmodified inside a toggle/column:** it renders a 6-column
  CSS grid with block-width cycling and a fixed `@dnd-kit` `SortableContext` keyed by
  top-level block ids — dropping a second, nested `SortableContext` inside creates
  ambiguous drop targets and DnD-kit context collisions. Build a purpose-specific,
  simpler nested renderer instead (per D-01's explicit permission to model this
  differently as long as it stays simple).
- **Introducing a rich-text editor library for `@mention`:** contradicts the project's own
  documented decision ("Deliberately no editor library") and is unnecessary — the existing
  trigger mechanism transposes directly.
- **Treating `documents.subject` as a free-form column:** it has a hard Postgres CHECK
  constraint; a new subject value is a schema change (migration), not just a TS type edit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline trigger detection (`/` and `@`) | A custom keystroke-recording rich text engine | The existing two-phase `pendingSlash`/keydown+input pattern in `EditableRichText.tsx`, cloned for `@` | Already solved, already handles Selection/Range edge cases and bails out safely |
| HTML sanitization | Hand-rolled regex stripping | `DOMPurify.sanitize(...)`, already imported everywhere text is committed | XSS-safety; consistent with every existing content block |
| File upload plumbing (if D-05 chooses real uploads) | A new upload component/endpoint | `packages/data/src/documents/FileUploader.tsx` + `useUploadDocument()` + `/api/v1/documents` | Already handles drag-drop, size limits, error states; CLAUDE.md's explicit reuse-over-rebuild constraint |
| Company user lookup for `@person` | A new `/api/v1/users` or `/api/v1/mentions/people` endpoint | `teamApi.list()` (`GET /api/v1/team`), already company-scoped | Zero new backend surface |
| Sub-page creation | A new "create child page" mutation | `projectsApi.createPage(projectId, { parent_page_id })`, already used by `PageTree.tsx`'s "Add sub-page" | Identical semantics already wired end-to-end |

**Key insight:** Every non-nesting requirement in this phase is a rerun of a pattern the
codebase already has 25+ working examples of (`PAGE_BLOCK_REGISTRY` has ~29 entries). The
only place genuine new design judgment is needed is the nested-children mechanism (toggle/
columns) and the `@`-mention popover/data-source wiring — everything else is
copy-the-pattern work.

## Common Pitfalls

### Pitfall 1: Forgetting the icon.tsx MAP step
**What goes wrong:** New block renders with a generic `Square` fallback icon in the slash
menu / insert menu, even though `blocks.ts` and `registry.tsx` are wired correctly.
**Why it happens:** The "extensibility contract" comment at the top of `blocks.ts` lists
only 3 steps (union member, renderer, registry entry) — it does not mention
`components/projectPage/icon.tsx`'s hand-maintained `MAP: Record<string, LucideIcon>`,
which is a 4th, undocumented step.
**How to avoid:** For every new `PageBlockDef.icon` string, add the corresponding lucide
import + `MAP` entry in `icon.tsx` in the same commit.
**Warning signs:** Slash menu shows a plain square icon for a newly added block kind.

### Pitfall 2: Treating `documents.subject` as freely extensible
**What goes wrong:** Adding `'page-block'` (or similar) to the TS `DocumentSubject` union
and the route's `ALLOWED_SUBJECTS` `Set` without a migration will pass TypeScript and even
pass the Express-level guard, but the `INSERT` will fail at the database with a CHECK
constraint violation (`documents_subject_check`) the first time a real upload is attempted.
**Why it happens:** The Postgres CHECK constraint (migration `002`) is a second,
independent enforcement point that isn't visible from the TypeScript layer alone.
**How to avoid:** If D-05 selects real uploads, write a new idempotent migration (next
number after `024`, i.e. `025_...sql`) that does
`ALTER TABLE documents DROP CONSTRAINT ... ; ALTER TABLE documents ADD CONSTRAINT ... CHECK (subject IN (...,'page-block'))` (or equivalent `DO $$ ... $$` idempotent block), matching the project's SQL migration conventions.
**Warning signs:** Upload succeeds through the UI/API in dev against a fresh DB seed but
fails against a DB migrated only through `024`.

### Pitfall 3: `@dnd-kit` `SortableContext` collision inside nested blocks
**What goes wrong:** If a nested toggle/column child list reuses `useSortable`/
`SortableContext` (copy-pasted from `LivePageCanvas.tsx`), nested and top-level drag
contexts can both claim the same drag events, causing dropped items to land in the wrong
list or the DnD library to throw in development (duplicate/ambiguous `id`s across nested
contexts, since block `id`s are globally unique but two `SortableContext`s in the DOM tree
without proper `id`-array partitioning can still misbehave with `closestCenter` collision
detection spanning DOM boundaries).
**Why it happens:** `@dnd-kit`'s collision detection operates over rendered DOM rects, not
strictly scoped to one `SortableContext`, unless nested contexts are deliberately isolated.
**How to avoid:** Per D-01's explicit invitation to keep this simple: skip drag-reorder
entirely inside toggle/column children in this phase (up/down move buttons or none at all
is sufficient) — this sidesteps the collision class of bug entirely and matches the user's
signal to default to the lower-cost implementation.
**Warning signs:** Dragging a child block inside a toggle/column reorders top-level page
blocks instead, or throws a dnd-kit invariant warning in the console.

### Pitfall 4: Mention span breaking `DOMPurify.sanitize()` round-trip
**What goes wrong:** A mention rendered as `<span data-mention-type="person"
data-mention-id="...">@Jane</span>` gets its `data-*` attributes silently stripped by
`DOMPurify.sanitize()` on the next commit (DOMPurify's default config only allows a
conservative attribute allowlist), turning the mention into plain unclickable text after
the first save/reload round-trip.
**Why it happens:** `EditableRichText.tsx`'s `commit()` calls `DOMPurify.sanitize(el.innerHTML)`
with default options; custom `data-*` attributes are not in the default `ALLOWED_ATTR`.
**How to avoid:** Pass an explicit DOMPurify config (`ALLOWED_ATTR` including
`data-mention-type`, `data-mention-id`, or `ADD_ATTR: ['data-mention-type', 'data-mention-id']`)
wherever mention-bearing HTML is sanitized — both in `EditableRichText.tsx`'s `commit()`
and `selectItem()`, and in whatever read-only renderer displays committed rich-text/list
blocks.
**Warning signs:** Mentions render correctly immediately after insertion but become plain
text after navigating away and back (i.e., after a save + reload round-trip through the API).

### Pitfall 5: Nested content-group filtering has no existing flag to reuse
**What goes wrong:** Implementing D-03's "only content-group blocks may nest" rule by
checking `item.group === 'content'` will incorrectly exclude sub-page and media blocks
(which the CONTEXT.md explicitly lists as nestable) since those are naturally `'widget'`-
grouped in the existing convention (they insert standalone rather than transforming an
empty text block).
**Why it happens:** `PageBlockGroup` was designed for a narrower purpose (slash-menu
transform-in-place eligibility, see `isContentItem()` in `slashMenu.ts`) before nesting
existed as a concept.
**How to avoid:** Add a new, explicit `nestable?: boolean` (default `false`) field to
`PageBlockDef`, set `true` on every block CONTEXT.md names as nestable (text, heading,
checklist, quote, code, media blocks, table, sub-page — explicitly NOT kanban, kpi-grid,
chart, crm-clients, and other data widgets), and filter the nested slash menu on that flag,
not on `group`.

## Code Examples

### Existing content-block editor pattern (reference for quote/checklist/code editors)
```typescript
// Source: apps/workspaces/src/components/projectPage/CalloutBlock.tsx
export function CalloutEditor({ block, onUpdate }: { block: CalloutBlock; onUpdate: (b: CalloutBlock) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== block.text) el.textContent = block.text;
  }, [block.text]);
  return (
    <div className={CONTAINER_CLASS}>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onBlur={() => {
          const next = (ref.current?.textContent ?? '').trim();
          if (next !== block.text) onUpdate({ ...block, text: next });
        }} />
    </div>
  );
}
```

### Sub-page creation (reuse verbatim)
```typescript
// Source: apps/workspaces/src/app/projects/[id]/page.tsx:69-77
async function addSubPage(parentPageId: string) {
  const created = await createPage.mutateAsync({ title: 'Untitled', parent_page_id: parentPageId });
  // For the sub-page BLOCK (new): instead of router.push, insert a SubPageBlock
  // referencing created.id into the current page's blocks, and optionally
  // still navigate the new page in a new tab per D-13's "click navigates" rule.
}
```

### Company-wide people list (reuse for @person mention data source)
```typescript
// Source: apps/workspaces/src/lib/hooks/useTeam.ts + apps/workspaces/src/lib/api/team.api.ts
export function useTeam() {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.team, queryFn: teamApi.list, enabled: !!user?.company_id, staleTime: 1000 * 30 });
}
// teamApi.list() → GET /api/v1/team → SELECT ... FROM users WHERE company_id = $1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — no prior nested-block or mention system exists in this codebase | This phase introduces both | Phase 21 (this phase) | First precedent; future phases (23's record card body) inherit whatever pattern this phase establishes for nesting and mentions |

**Deprecated/outdated:** None — this is additive, no existing block behavior changes
except the legacy `kanban` block, which stays untouched (its migration to `collection-view`
is explicitly Phase 24 per `.planning/ROADMAP.md`, not this phase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Syntax highlighting is NOT required for CONT-04 (a language label + `<pre><code>` suffices) | Standard Stack / Supporting | If the user actually wants colorized code, a library install + Package Legitimacy Gate run is needed later — low risk, easy to add incrementally |
| A2 | `@page` mention search should scope to the current project's pages only (no cross-project page search exists) | Summary / Architectural Responsibility Map | If broader (company-wide/cross-project) page search is actually expected, a new backend search endpoint is needed — should be raised explicitly to the user/planner as a scope decision, not silently assumed |
| A3 | Fixed 2-column layout (not flexible add/remove lanes) is the cheapest columns implementation satisfying CONT-07 (D-04 discretion) | Architecture Patterns / Pattern 2 | Low risk — if 3-column or flexible is later wanted, `columns: PageBlock[][]` shape already generalizes; only the settings UI would need to change |
| A4 | No drag-reorder inside toggle/column nested children (up/down buttons or none) is acceptable given D-01's "simple to render/edit" bar | Pitfall 3 | Low risk — explicitly aligned with the user's stated preference for the cheapest option; if reorder is later requested, it's an additive UI enhancement, not a rearchitecture |

## Open Questions (RESOLVED)

1. **`@page` mention search scope**
   - What we know: `projectsApi.listPages(projectId)` exists and is project-scoped; no
     cross-project or company-wide page search endpoint exists anywhere in the codebase.
   - What's unclear: Whether users expect to `@mention` a page from a different project.
   - Recommendation: Default to current-project-only (zero new backend work); note this
     limitation in the plan's task description so the planner can decide explicitly rather
     than by omission.
   - RESOLVED: Plan 21-02 adopts current-project-only scope — `buildMentionItems` only
     queries `projectsApi.listPages(ctx.projectId)` when `ctx.projectId` is present, and
     returns zero page items otherwise (e.g., on the client detail canvas).

2. **Real uploads vs. URL-only for media blocks (D-05)**
   - What we know: URL-only requires zero backend changes; real uploads require a new
     migration (CHECK constraint) plus `ALLOWED_SUBJECTS`/`DocumentSubject` edits.
   - What's unclear: Whether the phase's "media blocks" success criterion is satisfied by
     paste-a-URL alone, or whether users expect drag-and-drop file upload.
   - Recommendation: Given the explicit reuse-over-rebuild CLAUDE.md constraint AND the
     newly-discovered CHECK-constraint cost, recommend URL-only as the default for this
     phase unless the planner/user pushes back — it fully satisfies CONT-05's literal
     wording ("User can insert ... image/file/video/bookmark/embed media blocks") without
     implying upload is mandatory.
   - RESOLVED: Plan 21-03 ships URL-only media blocks (image/file/video/bookmark/embed via
     pasted URL) — no file upload, no new migration, no `ALLOWED_SUBJECTS`/`DocumentSubject`
     changes.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies beyond what's
already installed in the monorepo (Node.js, npm workspaces, existing npm packages already
verified present). No Docker/DB/Redis dependency is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/workspaces` (no jest/vitest/testing-library config or scripts found). `apps/api` has a minimal `node --test` runner (irrelevant here — this phase is frontend-only). |
| Config file | none — see Wave 0 |
| Quick run command | N/A — no test runner configured for `apps/workspaces` |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | Insert checklist, toggle item complete | manual-only | — | ❌ Wave 0 (no test framework) |
| CONT-02 | Insert toggle, collapse/expand children | manual-only | — | ❌ Wave 0 |
| CONT-03 | Insert quote block | manual-only | — | ❌ Wave 0 |
| CONT-04 | Insert code block with language picker | manual-only | — | ❌ Wave 0 |
| CONT-05 | Insert image/file/video/bookmark/embed | manual-only | — | ❌ Wave 0 |
| CONT-06 | Insert inline table block | manual-only | — | ❌ Wave 0 |
| CONT-07 | Insert multi-column layout | manual-only | — | ❌ Wave 0 |
| CONT-08 | Insert sub-page link, create-new-page flow | manual-only | — | ❌ Wave 0 |
| CONT-09 | `@mention` person/page/date, click-navigates | manual-only | — | ❌ Wave 0 |

*Justification for manual-only across the board:* every requirement is a contentEditable
DOM-interaction behavior (drag, click, type-and-select-from-popover) in a Next.js app with
zero existing frontend test infrastructure (no jsdom/RTL/Playwright config found anywhere
in `apps/workspaces`). Introducing a full frontend test framework is out of this phase's
scope per its description (pure block-registry additions) — this mirrors the apparent
existing project pattern where phases 1-20's UI work also has no automated frontend test
coverage (only `apps/api` has any automated tests).

### Sampling Rate
- **Per task commit:** manual smoke-check in the running dev server (`npm run dev` in
  `apps/workspaces`) against the specific block just added.
- **Per wave merge:** manual walkthrough of all newly-added slash-menu items + a
  save/reload round-trip (to catch the DOMPurify attribute-stripping class of bug in
  Pitfall 4).
- **Phase gate:** Full manual pass through all 5 success criteria listed in the phase
  description before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] No frontend test framework installed in `apps/workspaces` — if the planner wants any
  automated coverage for this phase, Wave 0 must install and configure one (e.g. Vitest +
  Testing Library), which is a nontrivial addition not currently scoped by CONTEXT.md.
- [ ] No existing test file conventions to follow in this app — recommend treating this
  phase as manual-verification-only (checkpoint:human-verify tasks) rather than retrofitting
  a test framework mid-phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unaffected — existing `authenticateToken` middleware unchanged |
| V3 Session Management | no | Unaffected |
| V4 Access Control | yes | Sub-page creation and media uploads must continue to flow through existing `authenticateToken` + `company_id`-scoped repository methods (`projectsApi.createPage`, `documentsRepository.insert`) — no new unauthenticated surface should be introduced |
| V5 Input Validation | yes | `DOMPurify.sanitize()` (with an explicit, narrowly-scoped `ALLOWED_ATTR`/`ADD_ATTR` for mention `data-*` attributes — see Pitfall 4) for all contentEditable-sourced HTML; URL-only media/bookmark/embed fields should validate the string looks like a URL client-side (not a hard security boundary, but prevents obviously malformed data) |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Stored XSS via contentEditable HTML (mention spans, table cell HTML, quote/toggle text) | Tampering | `DOMPurify.sanitize()` on every commit path, same as existing rich-text/list/callout blocks — do not bypass sanitization for new block kinds |
| SSRF via a hypothetical bookmark/embed link-preview scraping endpoint (D-06, only if chosen) | Tampering / Information Disclosure | If real server-side URL fetching is chosen for og:title/og:image scraping, validate/allowlist the target scheme (http/https only), reject private/internal IP ranges (RFC1918, localhost, link-local), and set a short timeout + response-size cap. If this control can't be confidently implemented in this phase's scope, prefer the styled raw-URL card (no server fetch) instead, per D-06's own noted tradeoff. |
| Arbitrary/oversized file upload via new media-block upload path (only if D-05 chooses real uploads) | Denial of Service | Reuse `FileUploader`'s existing size/type constraints verbatim (per D-08) — do not introduce a separate, more permissive upload path for page-embedded media |

## Sources

### Primary (HIGH confidence)
- `apps/workspaces/src/lib/projectPage/blocks.ts` — full read, `PageBlockKind` union, `PAGE_BLOCK_REGISTRY`, extensibility contract comment
- `apps/workspaces/src/lib/projectPage/registry.tsx` — full read, `entries` map, `WorkspaceBlockRegistry` wiring
- `apps/workspaces/src/lib/projectPage/slashMenu.ts` — full read, `buildSlashMenuItems`, `isContentItem`
- `apps/workspaces/src/lib/workspaceEngine/types.ts`, `registry.tsx` — full read, generic plugin engine contract
- `apps/workspaces/src/components/projectPage/EditableRichText.tsx` — full read, `/`-trigger mechanism (lines 124-183 specifically)
- `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` — full read, flat-array DnD canvas, confirms no nesting precedent
- `apps/workspaces/src/components/projectPage/PageTree.tsx`, `apps/workspaces/src/app/projects/[id]/page.tsx` — sub-page creation flow
- `apps/workspaces/src/components/projectPage/icon.tsx` — hand-maintained icon MAP (undocumented 4th extensibility step)
- `apps/workspaces/src/components/projectPage/CalloutBlock.tsx` — reference editor pattern
- `packages/data/src/documents/FileUploader.tsx`, `documents.api.ts` — upload component + client API
- `apps/api/src/domains/documents/documents.routes.ts` — `ALLOWED_SUBJECTS` server-side guard
- `database/migrations/002_realtime_and_documents.sql` — `documents.subject` CHECK constraint (critical finding, contradicts the CONTEXT.md's implied "just extend the union" framing)
- `packages/ui/src/appUrls.ts` — `crossAppUrl` cross-app link pattern
- `apps/workspaces/src/lib/hooks/useTeam.ts`, `apps/api/src/domains/team/team.repository.ts` — company-wide people list, already company-scoped
- `apps/workspaces/src/lib/api/projects.api.ts` — `listPages` (project-scoped only, no cross-project search)
- `docs/specs/core/workspace-blocks.md` — canonical spec, §5 (content blocks), §10 (Do/Don't)
- `.planning/phases/21-missing-content-blocks/21-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions and requirement IDs

### Secondary (MEDIUM confidence)
- None — no WebSearch was needed; this phase is entirely internal-codebase research (no new library adoption).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every recommendation reuses libraries already verified present in this exact repo via direct file reads, no version-guessing.
- Architecture: MEDIUM — the flat-block extension pattern is HIGH confidence (25+ existing examples), but the nested-children (toggle/columns) design is genuinely novel with no in-repo precedent, so its specific shape is a reasoned proposal, not a verified pattern.
- Pitfalls: HIGH — Pitfalls 1, 2, and 4 are grounded in direct code reads (icon.tsx MAP, documents CHECK constraint, DOMPurify default config); Pitfall 3 and 5 are reasoned from documented dnd-kit/registry behavior plus the absence of existing precedent.

**Research date:** 2026-07-13
**Valid until:** 2026-08-12 (30 days — stable internal codebase, no fast-moving external dependency)
