# Phase 33: Tree-Based Sidebar UI (Read + Navigate) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 33-Tree-Based Sidebar UI (Read + Navigate)
**Areas discussed:** Depth-aware module visibility, Breadcrumb behavior, Sidebar shape

---

## Depth-aware Module Visibility

| Question | Options | Selected |
|---|---|---|
| Disabled-module node nested in an enabled folder — what happens? | Hide only that node / Prune whole subtree / You decide | You decide |
| Should folders ever be hidden by module rules? | Folders always visible / Hide folders empty after filtering / You decide | You decide |
| Where does module-filtering run? | Client-side over `GET /folders/tree/full` / Server-side new API param / You decide | You decide |
| Do tree node_types map 1:1 to existing module keys? | 1:1 existing mapping / Something's missing | 1:1 existing mapping ✓ |

**Claude's resolution:** Prune whole subtree (natural outcome of recursive filter); hide folders left empty after filtering (bubble up); filter client-side (Phase 32 API already shipped, lower risk).

---

## Breadcrumb Behavior

| Question | Options | Selected |
|---|---|---|
| Where do breadcrumbs render? | Every project/page/record view / Only record/page detail views / You decide | You decide |
| Are segments clickable? | Clickable links / Static text | Clickable links ✓ |
| How do deep chains truncate? | Ellipsis-collapse / Full chain wrap-scroll / You decide | You decide |
| Ancestor path source? | Walk fetched tree client-side / New ancestor-path endpoint / You decide | You decide |

**Claude's resolution:** Deferred to planner/researcher — placement, truncation approach, and data-source choice depend on implementation specifics (page layout fit, whether full tree is reliably loaded on every breadcrumb-bearing page).

---

## Sidebar Shape

| Question | Options | Selected |
|---|---|---|
| Does the tree replace ITEMS entirely or coexist? | Tree replaces ITEMS entirely / New section alongside fixed nav / You decide | You decide |
| Tree roots — direct or under a heading? | Direct, no heading / Wrapped under section heading / You decide | You decide |
| Where do external crossAppUrl links sit? | Unchanged position / You decide | You decide |

**Claude's resolution:** Fixed nav items (Dashboard, Fleet, Automations, Marketplace, Metrics, Documents, Team/Settings, CMR external link) are app-level features, not organizational content — they stay unchanged. Tree renders as a new section with a small heading (matching the existing `ALWAYS_BOTTOM` separation pattern), inserted between top fixed items and `ALWAYS_BOTTOM`. External links keep current position.

---

## Claude's Discretion

- Depth-aware module visibility: subtree-pruning rule, empty-folder hiding, client-side filter location.
- Breadcrumb placement, truncation strategy, and ancestor-path data source.
- Sidebar section heading style and tree-section insertion point.
- Archived-node handling (area raised but not deep-dived — user chose to skip further questions on it): default assumption is to exclude `archived_at`-set nodes from this read-only tree; planner/researcher to confirm against Phase 32's API behavior.

## Deferred Ideas

None — discussion stayed within phase scope.
