# Phase 3: Per-Project Client Overrides - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 3-per-project-client-overrides
**Areas discussed:** UI location, Attach flow, Override UX, Unlink, Project side, Override scope

---

## UI location

| Option | Description | Selected |
|--------|-------------|----------|
| New section on client detail page | A 'Linked Projects' section/block on the client detail page lists attached projects; clicking one opens an override editor. | ✓ |
| On the project side | Attach/override clients from within the project page instead. | |
| Both places | Client detail page shows linked projects + overrides; project page also shows/edits attached clients. | |

**User's choice:** New section on client detail page (recommended option)

---

## Attach flow

| Option | Description | Selected |
|--------|-------------|----------|
| Search/select from all company projects | A project picker (searchable dropdown/modal) lists all company projects; user picks one to attach. | ✓ |
| Only via existing CrmClientsBlock on a project page | Attaching happens from the project side via the existing client block. | |

**User's choice:** Search/select from all company projects (recommended option)

---

## Override UX

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit toggle/placeholder per field | Each field shows the global value greyed out with an 'override' affordance; clear/reset button reverts to global. | ✓ |
| Always-editable, blank = global | Fields always editable inline, blank means use global default — matches Phase 2 sidebar pattern. | |

**User's choice:** Explicit toggle/placeholder per field (recommended option)
**Notes:** Deliberate departure from Phase 2's client-sidebar always-editable pattern — user wants "overridden vs inherited" to be visually unambiguous per field.

---

## Unlink

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, explicit unlink action | Remove/unlink button deletes the client_project_links row entirely. | ✓ |
| No unlink in v1 | Links are permanent once created for this phase. | |

**User's choice:** Yes, explicit unlink action (recommended option)

---

## Project side

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope — client detail page only | This phase only builds the linked-projects section on the client detail page. | ✓ |
| Also show linked clients on project page | Add a lightweight list of attached clients to the project page too. | |

**User's choice:** Out of scope — client detail page only (recommended option)

---

## Override scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field | Each of the 3 fields has its own independent override toggle. | ✓ |
| All-or-nothing | A single toggle per project link switches all 3 fields together. | |

**User's choice:** Per-field (recommended option)
**Notes:** Matches the client_project_links schema having 3 separate override columns.

---

## Claude's Discretion

- Exact layout/visual treatment of the "Linked Projects" section (list vs. cards, expand/collapse per project row).
- Whether the project picker is a modal or inline dropdown.
- Exact interaction widget for the per-field override toggle, as long as it satisfies the "visually unambiguous" requirement.
- Confirmation UX for unlink (whether a confirm dialog is needed).

## Deferred Ideas

- Attached-clients view on the project page — explicitly deferred to a future phase.
- Override history / audit trail on unlink — not requested.
