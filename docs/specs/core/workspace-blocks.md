# workspace-blocks.md — Notion/Loop-grade page & block system

Scope: the block-based page editor in `apps/workspaces` — the "Notion for
logistics" surface. Covers the editor (slash commands, rich text, nesting), the
generic content blocks, and — the heart of this document — turning Kanban from a
toy into a **real database board where each card is an openable page with
properties, assignees, dates, checklists and its own slash-command body**, to
Notion/Loop parity.

This documents what exists today, then specifies the gaps to close, grounded in
the actual code.

> Suggested location: `docs/specs/core/workspace-blocks.md`.
> Reads with: `program-builder.md`, `event-spine.md`, `kpi-engine.md`.

---

## 1. What already exists (do not rebuild)

The editor is further along than a from-scratch project. Before building, read:

- `apps/workspaces/src/lib/projectPage/blocks.ts` — `PageBlockKind` union,
  `PAGE_BLOCK_REGISTRY`, `PageConfig` (the saved shape).
- `apps/workspaces/src/lib/projectPage/slashMenu.ts` — slash/insert menu items,
  derived from the registry (Heading 1/2/3 and Bulleted/Numbered expanded here).
- `apps/workspaces/src/components/projectPage/SlashMenu.tsx` — the `/` popover
  (`SlashMenuPanel`) and the `+` insert menu (`InsertBlockMenu`), portaled.
- `apps/workspaces/src/components/projectPage/EditableRichText.tsx` — the
  contentEditable surface with the inline `/` trigger + query.
- `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` — the page
  canvas that renders/edits the block list.
- `apps/workspaces/src/components/projectPage/KanbanBlock.tsx` — current board.
- Persistence: `project_pages` table (`009`), nested via `parent_page_id`
  (`012_page_hierarchy.sql`), page header/cover (`013`). Config is opaque JSONB;
  the frontend owns block semantics. Lifecycle emits `page.created/updated/
  deleted` on the event spine.

**Already working, keep it:** slash menu (`/`) with grouped/filterable items;
`+` insert menu; rich text; Heading 1–3; bulleted/numbered lists; divider;
nested sub-pages (`parent_page_id`); per-page cover/header; the widget blocks
(kpi-grid, chart, stat-cards, activity-timeline, people, calendar, etc.).

**The extensibility contract (top of `blocks.ts`) is law:** a new block kind =
(1) union member, (2) renderer + settings panel in
`components/projectPage/blocks`, (3) register in `PAGE_BLOCK_REGISTRY`. Nothing
else changes; the slash/insert menus pick it up automatically.

---

## 2. The core gap: Kanban is a toy, not a database

### 2.1 What Notion/Loop actually is

In Notion, a Kanban board is **not** a standalone widget. It is **one view over
a database of pages**. The essential truths (confirmed against Notion's docs):

- Every card is a **full page**: open it and you get a title, a property panel
  (Status, Assignee, Due date, Priority, tags…), and a **body that is itself a
  block document** — headings, checklists, sub-tasks, files, comments, its own
  `/` slash menu.
- The board **groups by a property** (usually Status; can be Assignee, Priority,
  etc.). Moving a card between columns **sets that property** — columns are not
  the source of truth, the property is.
- The **same underlying items** can be shown as Table, Board, Calendar,
  Timeline, Gallery, or List — different lenses on one dataset. Editing in one
  updates all.
- Cards show a **configurable subset of properties** as a preview; the full set
  lives on the open page.
- Supports **sub-items** (nested cards), **filters/sorts per view**, and
  **sub-groups** (swimlanes).

### 2.2 What Vectra has today

`KanbanBlock` stores everything in the page config:

```ts
KanbanCard   = { id, text }                       // just a string
KanbanColumn = { id, title, cards: KanbanCard[] }
KanbanBlock  = { kind:'kanban', title?, columns }
```

Cards **cannot be opened**. There are **no properties, no assignee, no due date,
no checklist, no card body, no slash command inside a card**. Movement is
arrow-buttons, not drag. Columns *are* the data (no grouping property). This is a
Phase-1 placeholder — the code comment says as much ("cards live in the page
config … later phases rewire").

**This is the block to elevate to Notion/Loop parity.** The rest of §3–§6
specifies how.

---

## 3. Target architecture: Records + Views (the database model)

To reach parity without special-casing, introduce a generic **Records** layer
that Kanban (and Table/Calendar/Gallery) render as *views*. This is the same
"empty slate, generic primitives" rule as everywhere else — a "card" is a
**record**, a "board" is a **view**, and neither knows anything about logistics.

### 3.1 New generic primitives

**Data source (`data_collection`)** — a tenant-defined set of records with a
schema of generic properties. Backed by a table, not page JSON, so many views
and thousands of cards stay performant (Notion scales cards this way; page-JSON
does not).

Property types (generic, Notion-parity, no domain types):
`text`, `number`, `date` (single or range), `select`, `multi-select`,
`checkbox`, `person` (→ `users`), `url`, `email`, `phone`, `files`,
`relation` (→ another collection), `rollup`/`formula` (later), `created_at`,
`created_by`, `updated_at`.

**Record** — one row / one card. Has property values **and a body**: a block
document in the *same* `PageConfig` shape as a page (so a card's body reuses the
whole editor — slash menu, headings, checklists, sub-pages). This is what makes
"open the card and write more detail" work with zero new editor code.

**View** — a saved lens over a collection: `board | table | calendar | gallery |
list | timeline`. A view carries: `groupBy` (property, for board columns),
optional `subGroupBy` (swimlanes), `filters[]`, `sorts[]`, and `cardProperties[]`
(which properties preview on the card). Columns in a board are the **values of
the `groupBy` property**, generated — not hand-authored card buckets.

### 3.2 How the existing block plugs in

The page block becomes a **view embed**, not a data owner:

```ts
// replaces the config-local KanbanBlock
interface CollectionViewBlock extends PageBlockBase {
  kind: 'collection-view';
  collectionId: string;         // which data_collection
  viewId: string;               // which saved view (board/table/…)
  // display-only overrides may live here; data + schema live in the collection
}
```

`kanban` stays as a **legacy alias** that auto-migrates: on first edit, convert
its columns→a Status select property and its cards→records, then swap the block
to `collection-view` in board mode grouped by Status. No data loss, no flag day.

### 3.3 Schema (new migration, follows existing conventions)

Idempotent, numbered after the latest migration, `company_id`-scoped, generic
JSON for anything variable — mirroring `programs`/`project_pages`.

```sql
-- data_collections: a tenant's dataset + its property schema
CREATE TABLE data_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '[]',   -- ordered property definitions (generic)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- records: one card/row. props = property values; body = PageConfig block doc
CREATE TABLE collection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  parent_record_id UUID REFERENCES collection_records(id) ON DELETE CASCADE, -- sub-items
  props JSONB NOT NULL DEFAULT '{}',    -- { propId: value }
  body JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}', -- same shape as project_pages.config
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX collection_records_coll_idx ON collection_records (collection_id, sort_order);
CREATE INDEX collection_records_parent_idx ON collection_records (parent_record_id);

-- views: saved lenses (board/table/calendar/…)
CREATE TABLE collection_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES data_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'board',   -- board|table|calendar|gallery|list|timeline
  config JSONB NOT NULL DEFAULT '{}',   -- groupBy, subGroupBy, filters, sorts, cardProperties
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`props` values reference property ids from the collection's `schema`. `person`
props store `user` ids so they resolve to real team members (and can feed
assignments / notifications / the event spine). No domain columns anywhere —
"Shipment status" is just a `select` property a tenant named.

---

## 4. The card = a page (openable detail)

This is the feature the user called out. Opening a card must feel like Notion:

- Click a card → it opens (side-peek panel and/or full page). Same component for
  both; the peek is just a smaller frame.
- Top: editable **title**, then a **property panel** listing the collection's
  properties with inline editors (select dropdown, person picker, date picker,
  checkbox, etc.). Adding a property here adds it to the collection schema
  (Notion behaviour).
- Below: the **card body**, rendered by the **existing page editor**
  (`LivePageCanvas` + `EditableRichText` + `SlashMenu`) over `record.body`. That
  means inside a card the user gets the full `/` menu: **headings, checklists
  (to-dos), sub-tasks, responsible people (@mention / person property), files,
  callouts, tables, even nested collections** — with zero new editor code,
  because the body is the same `PageConfig` block document a page uses.
- Comments/mentions on the card reuse the existing chat/mentions + notifications
  plumbing.

Because the body reuses the page editor, **every content block below (§5) works
inside a card automatically.** That is the whole point of unifying on `PageConfig`.

---

## 5. Content blocks to reach Notion/Loop parity

The editor already has heading/text/list/divider and rich widgets. To be "Loop/
Notion to the last detail," add the missing **generic content blocks** (each is
a normal `PageBlockKind` + renderer + registry entry — they then appear in `/`
and inside card bodies for free):

Missing vs. Notion, in rough priority:

1. **`checklist` / `to-do`** — checkbox items with done state. (Core to task
   cards; currently only bulleted/numbered exist.)
2. **`toggle`** — collapsible section containing child blocks.
3. **`callout`** — coloured box with icon (notes/warnings).
4. **`quote`.**
5. **`code`** — fenced code block with language.
6. **`image` / `file` / `video` / `bookmark` / `embed`** — media blocks
   (the plan's §5.2 media blocks; only text-ish blocks exist now).
7. **`table` (simple)** — a lightweight inline table distinct from a
   collection-view table (Notion has both).
8. **`columns` / layout** — multi-column block layout (Loop/Notion side-by-side).
9. **`sub-page`** — inline link to a nested `project_pages` child (hierarchy
   exists in DB; expose it as an in-body block).
10. **`synced block`** (Loop signature) — same content mirrored in multiple
    places. Higher effort; later.
11. **`mention`** inline — @person / @page / @date inside rich text (person
    ties into assignments).

Slash-menu behaviour to match Notion (mostly present, verify/extend):
- `/` opens the menu inline; typing filters; ↑/↓ + Enter selects; Esc closes.
- Typing `/head`, `/todo`, `/board`, etc. jumps straight to that block.
- `+` handle on the left gutter of each block for insert; drag handle to reorder.

Editing niceties to confirm/add: markdown-style shortcuts (`# ` → H1, `- ` →
bullet, `[] ` → todo, `> ` → quote), block drag-reorder, block right-click/
`⋮⋮` menu (duplicate, delete, turn-into, move-to, colour), multi-block select.

---

## 6. Board interactions to match (Notion parity checklist)

For the `board` view specifically:

- **Drag-and-drop**: cards between columns (sets `groupBy` property) and reorder
  within a column (sets `sort_order`). Replace the current arrow buttons.
- **Group by any property**, switchable; columns are that property's values;
  "no value" column for empty; add a column = add a select option.
- **Sub-groups / swimlanes** (`subGroupBy`) — optional second axis.
- **Per-view filters & sorts** — e.g. "assignee = me", "due this week".
- **Card preview properties** — choose which props show on the card face;
  optional cover image (gallery-style).
- **Column aggregations** — count, % not empty, sum/avg of a number prop, date
  range (Notion's column calculations).
- **New card inline** ("+ New" per column) → creates a record with that column's
  `groupBy` value pre-set, opens the card for detail.
- **Switch view type** on the same data (board ↔ table ↔ calendar ↔ gallery ↔
  list ↔ timeline) without duplicating records.

---

## 7. Realtime & collaboration

Notion/Loop are collaborative. The platform already has a realtime bus
(`core/realtime`). Page/card edits should broadcast so two dispatchers editing a
board see live moves. Minimum: debounced autosave of `record.props` / `record.
body` + a `collection:record:updated` room event per company/collection, applied
optimistically. Full multi-caret co-editing (CRDT) is a later, separate effort —
do not block board parity on it; last-write-wins with realtime refresh is the
first target. (Track co-editing as its own spec item.)

---

## 8. Cloud vs. On-Premise

Nothing here is cloud-specific — it's plain Postgres + the existing editor, so it
works identically On-Premise. Two notes:
- `person` properties and `@mentions` resolve against the local `users` table,
  so assignment/notification stays inside the customer's install.
- Card bodies and record props live in the customer's DB (On-Prem = their
  server). Keep them free of anything that must not leave the box, same as the
  event-spine payload rule.

---

## 9. Build order (suggested)

1. Missing **content blocks** §5.1–5.6 (checklist, toggle, callout, quote, code,
   media) — cheap, high daily value, and they light up card bodies later.
2. **Records + Views schema** §3.3 and the record **card page** §4 (side-peek +
   property panel + body reusing the editor).
3. **`collection-view` block** + **board view** §6 with drag-and-drop and
   group-by; auto-migrate the legacy `kanban` block.
4. Additional view types (table, calendar, gallery, list, timeline) over the
   same collection.
5. Realtime record sync §7; then synced blocks / co-editing as later specs.

---

## 10. Do / Don't

**Do**
- Unify card bodies and pages on the **same `PageConfig`** so one editor serves both.
- Model boards as **views over a records collection grouped by a property**.
- Add capability as **new generic block kinds / property types**, picked up by
  the registry-driven slash menu automatically.
- Keep every property/block generic; "status", "carrier", "shipment" are tenant
  data, never platform types.
- Auto-migrate the legacy `kanban` block; never strand existing boards.

**Don't**
- Don't keep card data as `{id, text}` in page JSON — records go in tables so
  boards scale and support multiple views.
- Don't build a second editor for card detail — reuse the page editor.
- Don't hardcode column buckets; columns are a property's values.
- Don't add logistics-specific property types or blocks to core.
- Don't block board parity on full CRDT co-editing.
