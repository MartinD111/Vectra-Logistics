# Phase 21: Missing Content Blocks - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Card/page bodies get a complete generic block palette: checklist/to-do, toggle,
quote, fenced code with language picker, media blocks (image/file/video/
bookmark/embed), a simple inline table, a multi-column layout block, a
sub-page link block, and inline `@mention` (person/page/date). `callout`
already exists and is excluded. This is pure block-registry additions to the
existing `PageBlock` union / `PAGE_BLOCK_REGISTRY` / `pageBlockRegistry`
plugin system — no dependency on Phase 22's Records+Views data model.

</domain>

<decisions>
## Implementation Decisions

### Block nesting (toggle + columns)
- **D-01:** Blocks are currently a strictly flat array (`PageContent.blocks:
  PageBlock[]`) — no block has ever had children. Toggle and multi-column
  layout are the first blocks to introduce nesting. Claude has discretion on
  whether both share one `children: PageBlock[]` mechanism or are modeled
  differently, as long as the result is simple to render/edit.
- **D-02:** Nesting is capped at **one level deep** — a toggle or column may
  NOT contain another toggle or another columns block. This is a hard
  constraint, not just a recommendation, to keep rendering/editing/drag-reorder
  simple and avoid recursive edge cases.
- **D-03:** Only **content-group blocks** (text, heading, checklist, quote,
  code, media, table, sub-page, etc.) may be inserted inside a toggle or
  column — widget blocks (kanban, kpi-grid, chart, crm-clients, and similar
  data widgets) are NOT insertable as nested children. The slash menu inside a
  nested context must filter to content-group items only.
- **D-04:** Column count for the multi-column layout block is Claude's
  discretion (fixed 2/3-column choice vs. flexible add/remove lane) — pick
  whichever satisfies CONT-07 with the least new UI surface.

### Media blocks
- **D-05:** Upload vs. URL-only for image/file/video blocks is Claude's
  discretion. If choosing real uploads, reuse `packages/data`'s
  `FileUploader` + `/api/v1/documents` pipe by extending `DocumentSubject`
  (currently `company | driver | vehicle | shipment | booking`) rather than
  building new upload plumbing — per the project's reuse-over-rebuild
  constraint. If choosing URL-only, follow the same pattern as bookmark/embed.
- **D-06:** Bookmark/embed link-preview behavior (real og:title/og:image
  scraping via a new backend endpoint vs. a styled raw-URL card) is Claude's
  discretion, but note the security tradeoff: a scraping endpoint is a new
  external-URL-fetch surface (SSRF risk) that must be considered if chosen.
- **D-07:** Video block's YouTube/Vimeo embed support (iframe embed for known
  platforms, falling back to `<video>` for direct file URLs) vs. plain
  `<video>` tag only is Claude's discretion — pick whichever is cheapest while
  covering CONT-05.
- **D-08:** File-size/type limits for any new upload path must reuse
  whatever `FileUploader` already enforces — do not invent new, tighter
  limits for this phase.

### Inline @mention
- **D-09:** Whether to ship all three mention types (person/page/date) in
  this phase or person-only with page/date deferred is Claude's discretion,
  informed by implementation cost once the inline-trigger mechanism is
  researched. CONT-09 as written asks for all three — lean toward shipping
  all three unless the cost is clearly disproportionate; if deferring
  page/date, record that explicitly as a deferred idea (see below).
- **D-10:** Clicking a rendered mention **navigates**: `@person` → their
  profile/detail (or a hover card), `@page` → that page (new tab, following
  the existing `crossAppUrl`/link-navigation convention), `@date` → no action
  (styled text only). This is a locked decision, not discretion.
- **D-11:** Whether `@mention` fires a notification/activity-log entry to the
  mentioned person is Claude's discretion — reuse the existing
  notification/chat plumbing if it can be wired cheaply; otherwise ship the
  inline UI/resolution only and treat notification wiring as a natural
  follow-up (not blocking this phase).
- **Mechanism note:** `EditableRichText.tsx`'s existing `/` slash-trigger
  detection (two-phase keydown pre-check + input-event confirmation, tracking
  the trigger node/offset for a live query and range-replace on selection —
  see `EditableRichText.tsx:137-178`) is the pattern to follow for `@`
  detection; no new architectural approach is needed for the trigger itself,
  only a different query data source (people/pages/dates) and a different
  popover.

### Sub-page block
- **D-12:** Inserting a sub-page block via slash menu **always creates a
  brand-new empty child page** (reusing `PageTree.tsx`'s existing "Add
  sub-page" action and `parent_page_id` nesting) and inserts a link block to
  it. There is no "link an existing page" picker in this phase — locked
  decision, not discretion.
- **D-13:** The sub-page link block renders as a **static title + icon row**
  (page title + a page icon, click navigates) — no live content preview to
  keep in sync. Locked decision.

### Claude's Discretion
Several implementation-detail decisions above were explicitly left to Claude
(D-01, D-04, D-05, D-06, D-07, D-09, D-11) — the user trusts the
research/planning agents to pick the cheapest option that satisfies the
mapped requirement (CONT-01 through CONT-09) without over-engineering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Block system spec (source of this phase's scope)
- `docs/specs/core/workspace-blocks.md` §5 ("Content blocks to reach
  Notion/Loop parity") — the exact block list (checklist, toggle, callout
  [already done], quote, code, media, table, columns, sub-page, mention,
  synced-block [explicitly deferred, not in CONT-01..09]) and priority order.
  §10 ("Do/Don't") governs how new blocks must be added (registry-driven,
  no logistics-specific types).
- `.planning/REQUIREMENTS.md` — CONT-01 through CONT-09, the requirements
  this phase must satisfy.
- `.planning/ROADMAP.md` Phase 21 section — success criteria and dependency
  note (Phase 21 has no dependencies; Phase 23 depends on Phase 21's blocks).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/lib/projectPage/blocks.ts` — `PageBlockKind` union,
  `PageBlock` variants, `PAGE_BLOCK_REGISTRY` (metadata + `create()` factory).
  The extensibility contract at the top of this file (union member + renderer
  + registry entry) is law — follow it exactly for every new block kind.
- `apps/workspaces/src/lib/projectPage/registry.tsx` — `pageBlockRegistry`,
  built via the generic `WorkspaceBlockRegistry<PageBlock, PageCtx>` engine
  (shared with mini-programs, per the v2.0 unification). Each new block kind
  needs one `entry(...)` call here wiring a renderer + editor.
- `apps/workspaces/src/lib/projectPage/slashMenu.ts` — `buildSlashMenuItems()`,
  `EXTRA_KEYWORDS`, `isContentItem()`. `PageBlockGroup` is currently only
  `'content' | 'widget' | 'soon'` — new content-formatting blocks (checklist,
  toggle, quote, code, table) slot into `'content'`; media/embed/sub-page/
  mention fit `'widget'` (they insert as standalone blocks, not inline
  transforms).
- `apps/workspaces/src/components/projectPage/EditableRichText.tsx:137-178`
  — the `/` slash-trigger detection mechanism; template for `@` mention
  detection (see D-mechanism-note above).
- `apps/workspaces/src/components/projectPage/PageTree.tsx:12-77` — recursive
  page tree over `parent_page_id`; has "Add sub-page" (create) already wired.
  Reuse for the sub-page block's create action.
- `packages/data/src/documents/FileUploader.tsx` + `documents.api.ts` +
  `useDocuments.ts` — full drag-and-drop upload component, `FormData` upload
  mutation, hitting `/api/v1/documents`. `DocumentSubject` currently
  `company | driver | vehicle | shipment | booking` — would need a new
  subject value if media blocks do real uploads (D-05).
- `database/migrations/012_page_hierarchy.sql` — `parent_page_id` column +
  index already backs page nesting; no new migration needed for sub-page
  linking.

### Established Patterns
- Blocks are strictly flat today (`PageContent.blocks: PageBlock[]`) — no
  precedent for nested/child blocks anywhere in the codebase (checked
  mini-program blocks too — its `'columns'` kind is an unrelated data-table
  column selector, not a layout concept). Toggle/columns are genuinely new
  ground; do not assume a pattern exists to copy.
- No `multer` usage found anywhere outside `node_modules` — the only upload
  path in the app is the `packages/data` documents pipe described above.
- No existing `@mention` system anywhere in the codebase — this is fully new.

### Integration Points
- New block kinds register in `PAGE_BLOCK_REGISTRY` (blocks.ts) and
  `pageBlockRegistry` (registry.tsx) — both files, in lockstep, per the
  `entry()` helper and the `Record<PageBlockKind, WorkspaceBlockPlugin>`
  exhaustiveness proof.
- If media blocks do real uploads: extends `DocumentSubject` in
  `packages/data/src/documents/documents.api.ts`.
- If bookmark/embed does real link previews: needs a new backend endpoint
  (does not exist today) — flag the SSRF consideration to the researcher.
- Sub-page block's "create new page" reuses whatever service/API `PageTree.tsx`
  already calls for "Add sub-page".

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references given beyond "Notion/Loop parity" (already
the spec's framing). The user consistently favored the simpler/cheaper option
when a locked choice was made (one-level nesting cap, content-only nested
children, create-only sub-page, static sub-page preview, reuse existing
upload limits) and otherwise deferred to Claude's judgment — treat this as a
general signal: default to the lower-cost implementation when in doubt.

</specifics>

<deferred>
## Deferred Ideas

- **Synced blocks** (Loop's "same content mirrored in multiple places") —
  explicitly called out in `docs/specs/core/workspace-blocks.md` §5 item 10
  as higher-effort/later, and not in CONT-01..09. Not in scope for Phase 21.
- **Full CRDT/multi-caret co-editing** — explicitly out of scope per the spec
  §7; last-write-wins + realtime refresh is the stated first target for a
  later phase.
- **Link-an-existing-page picker for the sub-page block** — deferred by
  decision D-12; only "create new" ships this phase. If a future phase wants
  it, `PageTree.tsx` already has the data needed for a picker.
- **@mention notifications**, if not implemented under D-11's discretion —
  should be picked up as a natural follow-up once the base mention UI exists.

### Reviewed Todos (not folded)
None — no todos matched this phase (`gsd-sdk query todo.match-phase` returned
zero matches).

</deferred>

---

*Phase: 21-Missing Content Blocks*
*Context gathered: 2026-07-13*
