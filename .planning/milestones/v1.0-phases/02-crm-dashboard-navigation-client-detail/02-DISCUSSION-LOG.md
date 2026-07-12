# Phase 2: CRM Dashboard, Navigation & Client Detail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 2-crm-dashboard-navigation-client-detail
**Areas discussed:** CRM dashboard layout & source, Client detail page data model, Detail page section layout

---

## CRM Dashboard Layout & Source

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page table | Dedicated data table, sortable/scannable, row click opens detail in new tab | ✓ |
| Card grid, same visual style as CrmClientsBlock | Reuses existing card+credit-bar visual full-page | |
| Table with card-style row expansion | Compact table, click expands inline before opening detail page | |

**User's choice:** Full-page table (Recommended)
**Notes:** Better fit for a primary CRM home than the compact card style.

| Option | Description | Selected |
|--------|-------------|----------|
| Name, country, credit status, responsible employee | Compact, scannable default columns | ✓ |
| Add outstanding balance + credit limit as separate numeric columns | Explicit € figures instead of just a bar | |
| Minimal: name + credit status only | Everything else only on detail page | |

**User's choice:** Name, country, credit status, responsible employee (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Name search + over-limit filter | Text search + quick over-limit toggle | ✓ |
| Plain sortable table, no search/filter | Sorting only for v1 | |
| Full filter bar (name, country, employee, credit status) | More powerful, more UI surface | |

**User's choice:** Name search + over-limit filter (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep a simple "Add client" button/modal | Single-client creation stays available | ✓ |
| Remove single-add, Excel import only | Simplifies dashboard until Phase 4 | |

**User's choice:** Keep a simple "Add client" button/modal (Recommended)

---

## Client Detail Page Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| New `client_pages` table | Mirrors project_pages, keyed by client_id | ✓ |
| Make `project_pages.project_id` nullable + add client_id | Single table, touches existing heavily-used table | |
| Client detail page is NOT a block-canvas document | Purpose-specific fixed layout, conflicts with DET-04 | |

**User's choice:** New `client_pages` table (Recommended)
**Notes:** `project_pages.project_id` is `NOT NULL` today — confirmed via `database/migrations/009_project_pages.sql`. Clean separation, no risk to existing project page behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| "New client" entry point inside the project page creator | Reuses creator UI, writes to new table | ✓ |
| Client picker embedded as a block inside a project page | No changes to page creator's own menu | |

**User's choice:** "New client" entry point inside the project page creator (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Open the existing detail page, don't create a duplicate | One detail page per client (unique on client_id) | ✓ |
| Allow multiple detail pages per client | No uniqueness constraint | |

**User's choice:** Open the existing detail page, don't create a duplicate (Recommended)

---

## Detail Page Section Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + main canvas | Persistent settings sidebar + block canvas for current-situation/timeline | ✓ |
| Tabs: Overview / Timeline | Simpler, hides timeline behind a click | |
| Single stacked page, top to bottom | Classic CRM contact page layout | |

**User's choice:** Sidebar + main canvas (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline click-to-edit, autosave | Matches Notion-like feel of rest of page canvas | ✓ |
| Explicit Edit/Save mode | Clearer boundaries, more clicks | |

**User's choice:** Inline click-to-edit, autosave (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Visible empty state with placeholder copy | Section renders now, satisfies roadmap's empty-state criterion | ✓ |
| Hide the section entirely until Phase 5 | Less visual noise, but doesn't satisfy roadmap criterion as directly | |

**User's choice:** Visible empty state with placeholder copy (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Single unified chronological feed | All event types interleaved, tagged by type | ✓ |
| Type filter tabs within one timeline | More UI, more flexibility | |

**User's choice:** Single unified chronological feed (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| All team members in the company | Reuses existing team/users list | ✓ |
| Only users with a specific role | Requires defining eligible roles, adds scope | |

**User's choice:** All team members in the company (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fully deferred to Phase 3 | Detail page covers only client-level fields + timeline/current-situation | ✓ |
| Show a read-only "linked projects" list now | Gets ahead of Phase 3, touches a table not otherwise needed | |

**User's choice:** Fully deferred to Phase 3 (Recommended)

---

## Claude's Discretion

- Exact table/column widths, icon choices for timeline entry types, empty-state copy wording.
- Whether the "Add client" modal reuses `CrmClientsBlock`'s existing form fields/validation as-is or is rebuilt standalone.

## Deferred Ideas

- Linked projects / per-project overrides on the detail page — Phase 3 (CLI-04, CLI-05).
- Role-based responsible-employee picker — potential v2 refinement.
- Timeline type-filter tabs — potential future addition.
