# Phase 13: Cleanup, ADR & Park WorkflowBuilder - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the now-dead switch-statement duplication in the project-page and mini-program render/edit paths (already superseded by the registry engine built in Phases 7-12), document the resulting engine architecture in an ADR (native-vs-manifest split, the `keyOf` seam, and the package-promotion path), and explicitly park `components/automations/WorkflowBuilder.tsx` as a deferred future migration target — with zero behavior change and zero code changes to WorkflowBuilder.tsx itself.

</domain>

<decisions>
## Implementation Decisions

### Switch-cleanup scope
- **D-01:** The two remaining `switch (block.kind)` statements — `apps/workspaces/src/components/miniProgram/BlockSettings.tsx` and `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` — are **out of scope** for removal. These are per-kind settings-form switches, not render/edit dispatch (render/edit switches were already removed in Phases 8-10). Folding them onto the registry would be a new abstraction (an optional per-plugin settings renderer), not cleanup, and isn't covered by the roadmap success criteria (`DOC-01` explicitly scopes the `rg 'switch (block.kind)'` check to "page or mini-program render or edit paths"). Note this explicitly in the ADR as an intentional, permanent exception — not a TODO.
- **D-02:** Beyond the switch-statement check itself, do a light sweep of the files touched across Phases 7-12 (`PageBlockView.tsx`, `BlockView.tsx`, `LivePageCanvas.tsx`, `registry.tsx` files, `slashMenu.ts`) for other switch-era leftovers — unused helper functions, orphaned imports, commented-out code — and remove anything obviously dead. Keep this sweep scoped to files already touched by the engine-unification work; don't go hunting project-wide.

### WorkflowBuilder deferral note
- **D-03:** `WorkflowBuilder.tsx` gets **zero changes** — no header comment, no code touch of any kind. It must compile byte-identical to its pre-phase state (matches roadmap success criterion #3 literally). The ADR is the single source of truth for the deferral note; nothing in-file points at it.
- **D-04:** The ADR's WorkflowBuilder section goes beyond a one-line pointer. It should: (a) name WorkflowBuilder as the third parallel block/node system alongside Project Pages and Mini Programs, (b) describe why it's out of v2.0 scope — it's demo-only (hardcoded `initialNodes` array, no persistence, no registry), and the full Automation Engine is its own future milestone per PROJECT.md's Five Engines section, (c) sketch the future migration shape at a conceptual level: `WorkflowNode`'s `type: 'trigger' | 'condition' | 'action'` could someday become `WorkspaceBlockPlugin` kinds on the same `WorkspaceBlockRegistry`, following the same native/manifest split already proven in this milestone.

### Claude's Discretion
- ADR location/format (single `docs/` file vs. starting a `docs/adr/NNNN-title.md` series) — not discussed, left to planner/executor judgment. Recommend checking existing `docs/` conventions (flat files: API.md, DEPLOYMENT.md, CONTRIBUTING.md, HANDOFF.md, specs/) before deciding.
- Depth of the "package-promotion path" section (DOC-02) — not discussed. `packages/{ui,auth,api-client,types,data,config}` already exist as precedent for app-local → shared-package promotion; a paragraph referencing that pattern is likely sufficient unless research surfaces a need for more.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 13: Cleanup, ADR & Park WorkflowBuilder" — success criteria (DOC-01, DOC-02)
- `.planning/REQUIREMENTS.md` §"Docs & Cleanup (DOC)" — DOC-01, DOC-02 full text
- `.planning/PROJECT.md` §"Platform Vision & Architecture (North Star)" — "The Five Engines" section, source of the Automation Engine framing used in the WorkflowBuilder deferral note

### Engine architecture (what the ADR documents)
- `apps/workspaces/src/lib/workspaceEngine/types.ts` — `WorkspaceBlockRegistry`/`WorkspaceBlockPlugin` contract (native vs. manifest)
- `apps/workspaces/src/lib/workspaceEngine/registry.tsx` — generic registry implementation
- `apps/workspaces/src/lib/workspaceEngine/palette.ts` — `buildPaletteItems`, the registry-driven palette helper (Phase 11)
- `apps/workspaces/src/lib/projectPage/registry.tsx` — `pageBlockRegistry`, `keyOf` resolution for page blocks
- `apps/workspaces/src/lib/miniProgram/registry.tsx` — `miniProgramBlockRegistry`, `keyOf` resolution for mini-program blocks
- `.planning/phases/12-extensibility-proof/12-PATTERNS.md` — most recent worked example of adding a plugin entry end-to-end (native `callout` block + manifest `rowCountCallout` plugin)

### Files with remaining switches (to verify/clean)
- `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` — settings-panel switch, explicitly out of scope (D-01)
- `apps/workspaces/src/components/miniProgram/BlockSettings.tsx` — settings-panel switch, explicitly out of scope (D-01)

### WorkflowBuilder (deferred, do not modify)
- `apps/workspaces/src/components/automations/WorkflowBuilder.tsx` — 198 lines, `WorkflowNode` interface with `type: 'trigger' | 'condition' | 'action'`, hardcoded `initialNodes` array, no persistence/registry integration. Reference only — D-03 forbids touching it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/{ui,auth,api-client,types,data,config}` — existing precedent for the "package-promotion path" the ADR must document (an app-local plugin graduating to a shared `@vectra/*` package).

### Established Patterns
- Registry exhaustiveness: `Record<PageBlockKind, WorkspaceBlockPlugin<...>>` fails `tsc --noEmit` if a union member is missing an entry — this is the existing compile-time safety net worth citing in the ADR as the mechanism that makes "one plugin entry, nothing else changes" trustworthy.
- `keyOf(block)` resolvers exist separately in `projectPage/registry.tsx` and `miniProgram/registry.tsx` — the seam DOC-02 asks the ADR to document.

### Integration Points
- No new integration points this phase — purely subtractive (dead code removal) plus documentation. Zero runtime/behavior change expected.

</code_context>

<specifics>
## Specific Ideas

No specific UI/behavior requests — this is a docs-and-cleanup phase with no user-facing surface.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. WorkflowBuilder's actual migration onto the engine is itself the deferred item this phase documents (not implements) — tracked as a future automations milestone per PROJECT.md's Five Engines.

</deferred>

---

*Phase: 13-cleanup-adr-park-workflowbuilder*
*Context gathered: 2026-07-11*
