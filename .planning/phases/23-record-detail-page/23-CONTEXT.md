# Phase 23: Record Detail Page - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A record opens as a full page — title, schema-driven property panel, and body — reusing the existing block editor with zero new editor code. Pure frontend consumer of Phase 22's `/api/v1/records/*` domain and Phase 21's `LivePageCanvas`/`PAGE_BLOCK_REGISTRY`. No new backend endpoints, migrations, or npm packages. Board/list/collection-listing UI (how a user navigates *to* a record) is out of scope — that's Phase 24.

Most visual/layout/interaction decisions are already locked in `23-UI-SPEC.md` (approved design contract) and `23-RESEARCH.md` (HIGH confidence, fully code-verified). This discussion focused only on the remaining open items RESEARCH.md explicitly flagged for user input.

</domain>

<decisions>
## Implementation Decisions

### Record Title Source
- **D-01:** The record's title is sourced from the collection's **first schema property** (by array order) — not a reserved property id, not a new `title` column. Rendered as the inline-editable `text-xl font-bold` heading per UI-SPEC. Requires zero changes to Phase 22's data model or collection-creation flow. This convention also governs how Phase 24's board cards will source a display title later — do not invent a second convention there.

### Multi-Select Property Editor
- **D-02:** Multi-select properties render as **multi-chip toggle** buttons (pill/chip per option, filled = selected, outline = unselected) — not a checkbox list. This is a new UI pattern with no existing analog in the codebase (no chip-toggle component exists yet in `apps/workspaces`); build it as a small new component rather than searching for one to reuse. Phase 24+ board columns reading `select`/`multi-select` values should reference this same visual pattern for consistency.

### Design System
- **D-03:** Confirmed — do NOT initialize shadcn for this phase. Use the existing hand-rolled Tailwind system exclusively (`saas-card`, `saas-input`, `primary-*` scale, `label-xs`), per UI-SPEC's default. User explicitly agreed with the UI-SPEC's flagged default rather than overriding it.

### Claude's Discretion
- **Testability entry point** (RESEARCH.md Open Question 3) — not discussed; left to planner's discretion. Since Phase 24 (board) doesn't exist yet, the planner may choose either a minimal temporary record-list scratch view for manual testing, or rely on direct-URL navigation + manual verification. Do not scope-creep this into building any real collection-list/board UI.
- Exact `select`/`multi-select` `options` storage shape (`{id, label}[]`) — already specified in RESEARCH.md A3 and UI-SPEC; not re-litigated here, follow as documented.
- Person-property picker implementation — clone `EmployeeOverrideField`'s pattern per RESEARCH.md; no open question, not discussed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 locked design and research (primary)
- `.planning/phases/23-record-detail-page/23-RESEARCH.md` — full architecture, pitfalls, code examples, pattern-cloning guidance (HIGH confidence)
- `.planning/phases/23-record-detail-page/23-UI-SPEC.md` — approved visual/interaction design contract (spacing, typography, color, copywriting, layout contract) — locks nearly everything not covered in `<decisions>` above

### Records + Views product spec (locked schema this phase consumes)
- `docs/specs/core/workspace-blocks.md` §3.1 — property types, Record/View concept definitions
- `docs/specs/core/workspace-blocks.md` §4 — card/record detail page design intent ("same component for side-peek and full page", body reuses editor)
- `docs/specs/core/workspace-blocks.md` §10 — Do/Don't list (don't build a second editor for record bodies)

### Prior phase verification (confirms this phase's backend dependencies are shipped)
- `.planning/phases/22-records-views-data-model/22-VERIFICATION.md` — REC-01..04 backend contracts verified, 102/102 API tests passing
- `.planning/phases/21-missing-content-blocks/` (all 5 `*-SUMMARY.md`) — confirms the block registry this phase's body editor reuses is complete

### Project-level context
- `.planning/PROJECT.md` — "reuse over rebuild" constraint (Excel import / crossAppUrl reuse patterns), no-ORM convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/workspaces/src/app/records/[clientId]/page.tsx` — the direct structural template to clone (property-panel sidebar + `LivePageCanvas` body, seed-once + debounced-autosave pattern). Do not reuse its route path (`/records/[clientId]`) — already claimed by the CRM client detail page (route collision, see RESEARCH.md Pitfall 3).
- `apps/workspaces/src/components/miniProgram/DynamicBlockSettings.tsx` — canonical type-switch pattern for the schema-driven property editor.
- `EmployeeOverrideField` (in `records/[clientId]/page.tsx`) — clone for the `person` property type's dropdown picker (backed by `useTeam()`).

### Established Patterns
- Seed-once + 1500ms debounced autosave + unmount-flush for `LivePageCanvas`-backed body editors — proven pattern, do not re-derive (RESEARCH.md Pattern 1).
- Blur-commit + 800ms debounce for text property fields; immediate commit for checkbox/select/date/person (RESEARCH.md/UI-SPEC).
- Two-sequential-request rule for "add property": `PATCH /collections/:id` (schema) must complete before `PATCH /records/:id` (value) — combining them causes a 400 (RESEARCH.md Pitfall 1).

### Integration Points
- New route: `/collections/[collectionId]/records/[recordId]` (distinct from `/records/[clientId]`).
- New files expected: `components/records/{PropertyPanel,PropertyField,AddPropertyModal}.tsx`, `lib/api/records.api.ts`, `lib/hooks/useRecords.ts` (per RESEARCH.md's recommended project structure).
- `LivePageCanvas` called with zero new props (`config={record.body} onChange={setBody}`) — any block needing project/page context (e.g. sub-page links) shows its existing "not available here" fallback; this is expected, not a bug.

</code_context>

<specifics>
## Specific Ideas

No new specific references beyond what RESEARCH.md/UI-SPEC.md already capture. The three decisions above were the only open items the user chose to weigh in on; everything else follows the existing design contract and research recommendations as written.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Testability entry point is not a deferred idea but an explicit Claude's-discretion item (see `<decisions>` above), and board/collection-list UI is already correctly scoped to Phase 24, not this discussion.

</deferred>

---

*Phase: 23-record-detail-page*
*Context gathered: 2026-07-14*
