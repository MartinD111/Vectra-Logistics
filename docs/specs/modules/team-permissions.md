# team-permissions.md — Users, roles & permissions

Scope: `apps/api/src/domains/team` (member management, project assignments)
plus the RBAC mechanism it sits on (`core/auth/middleware.ts`). The headline
finding: team member management is solid and complete, but the business
plan's "dodeljevanje pravic (kdo vidi katere projekte, podatke)" — configurable
visibility — **does not exist**. A table that looks exactly like it should
power that (`project_assignments`) is real and populated, but is used
exclusively for KPI/utilization math today, never for access control.

> Suggested location: `docs/specs/modules/team-permissions.md`.
> Reads with: `event-spine.md` (this domain emits correctly — a good
> reference), `kpi-engine.md` §3.1 (the `outlook_calendar` evaluator is
> `project_assignments`' only real consumer today).

---

## 1. What's real and solid

`team.service.ts`/`team.repository.ts` — member CRUD is complete and
correctly built:
- **Add / remove / change role / change custom title** — all admin-gated,
  all emit the right spine events (`team.member.added/removed/role_changed/
  custom_role_updated`) per `event-spine.md`'s convention. This domain is a
  good reference for "how event emission should look" — no gaps found here,
  unlike `fleet.md`/`marketplace-ltl.md`'s findings elsewhere.
- **Double-enforced admin gating**: both route-level (`requireRole(['admin'])`
  in `team.routes.ts`) and service-level (`assertAdmin(requestingRole)` inside
  every mutating method). Redundant but consistent — a service method can't be
  called with a non-admin role even if a future route forgets the middleware.
- **`project_assignments`** (migration `007`): links a user to a project with
  a `planned_pct` (0–100, workday percentage). Real schema, real CRUD
  (`assignProject`/`updateAssignment`/`removeAssignment`/`listAssignments`),
  correctly `company_id`-scoped and ownership-checked
  (`assertOwnedProject`).
- **`custom_role_title`**: a free-text label ("Dispatcher", "Fleet Manager")
  a company can set per member. The migration's own comment is explicit and
  worth repeating exactly because it's easy to assume otherwise: *this does
  **not** replace or affect the permission enum.* It's purely cosmetic/
  organisational — filtering and grouping in the UI, zero enforcement. Keep
  describing it that way; don't let a future feature quietly start treating it
  as a real permission level without deliberately building that.

---

## 2. The gap: `project_assignments` exists for exactly the right purpose and is never used for it

This is the central finding. Business plan §7.8 (Team) describes
"dodeljevanje pravic (kdo vidi katere projekte, podatke)" as a core
capability. `project_assignments` — a table linking specific users to
specific projects — is the obvious schema for that. **It is not used for
visibility at all.**

Confirmed directly: `projects.repository.ts::listProjects` returns **every
project in the company** to anyone who calls it — no join against
`project_assignments`, no filter by the requesting user. The only real
consumer of `project_assignments` today is `kpi-engine.md`'s
`outlook_calendar` evaluator (planned-vs-actual staffing %) and the
per-project stats endpoint. A non-admin team member sees and can act on every
project the company has, regardless of whether they're assigned to it.

**This is a real, buildable gap, not a fundamental redesign**: the schema
already exists, the assignment CRUD already exists, only the *read-path
filter* is missing. Two shapes to choose between, deliberately:
- **(a) Opt-in restriction** — a company-level setting ("restrict project
  visibility to assignments") defaulting to today's behaviour (everyone sees
  everything), so small dispatch teams that don't want this friction aren't
  forced into it.
- **(b) Always-on for non-admins** — `listProjects` joins
  `project_assignments` and admins see everything, non-admins see only
  assigned projects.

Recommendation: **(a)**, since today's "everyone sees everything" is likely
the working assumption small teams already operate under, and silently
changing that for every existing company on an upgrade would break workflows
without warning. Make it explicit and company-configurable rather than a
blanket behaviour change.

---

## 3. RBAC is extremely coarse — worth naming precisely

Searched every `requireRole([...])` call in the backend. There are exactly
**two** distinct permission gates in the entire application:
```
requireRole(['admin'])              — 6 routes
requireRole(['carrier', 'admin'])   — 4 routes
```
No route anywhere gates on `'shipper'` specifically — meaning the `shipper`
role, while a real signup option (`authController.signup`), currently unlocks
or restricts nothing distinct from `carrier` in the backend's authorization
layer. Everything else in the platform is reachable by any authenticated user
of the company once they clear whichever of the two gates above applies (or
neither, for most routes). There is no per-domain, per-feature, or
per-department permission model beyond this.

### The role enum itself is a hard Postgres `ENUM`, inconsistent with the rest of the codebase's extensibility convention
`user_role` is `CREATE TYPE user_role AS ENUM ('carrier', 'shipper',
'admin')` — a real Postgres enum, requiring `ALTER TYPE … ADD VALUE` (a
migration) to add a role. This cuts against a pattern the rest of the
codebase deliberately follows elsewhere: `kpi_rules.source_type`,
`programs.type`, `programs.status` are all **plain TEXT validated by Zod**,
specifically so new values need no migration (`kpi-engine.md` §1,
`program-builder.md` §7 both note this explicitly as intentional). `user_role`
predates that convention (it's part of the original marketplace-era
`init.sql` schema) and was never revisited. Worth flagging before adding any
new role: either migrate to the TEXT+Zod pattern first, or accept that roles
will always require a schema migration to extend, as a deliberate (not
accidental) choice.

### No "department" concept
Business plan §7.8 mentions "Oddelki (dispo, špedicija, računovodstvo)"
alongside role/permission management. **Nothing in the codebase models a
department** — confirmed by search. `custom_role_title` (§1) is the closest
adjacent concept but is explicitly cosmetic, not a grouping/permission
mechanism. If departments are wanted as a real filtering/visibility unit
(not just a display label), that's net-new — likely modelled as a simple
tenant-owned lookup table (same "editable settings list" pattern used
throughout the reference programs and `procurement.md` §4's carrier
directory) with users optionally tagged to one, rather than anything
enum-based.

---

## 4. Dead code: `requireVerified`
`core/auth/middleware.ts` exports `requireVerified` (blocks unverified users),
and `authController.signup` does create email-verification tokens
(`auth_tokens`, type `email_verification`). **`requireVerified` is never
applied to any route** — confirmed by search; it exists only in its two
defining files. Either wire it into whichever routes are meant to require a
verified email (if that's still an intended flow) or remove the dead
middleware and the unused verification-token machinery together — leaving it
half-built is misleading to anyone assuming email verification is enforced
today.

---

## 5. Recommended build order

1. **Enforce `project_assignments` for visibility** (§2) — highest value,
   cheapest fix, reuses schema and CRUD that already exist. Ship as
   opt-in (option (a)).
2. **Decide the `user_role` extensibility question** (§3) before adding any
   new role value — migrate to TEXT+Zod now if more roles are anticipated
   soon (e.g. a real `dispatcher` permission level, not just a title);
   otherwise explicitly accept the enum as-is.
3. **Resolve `requireVerified`** (§4) — wire it in or remove it; don't leave
   it ambiguous.
4. **Departments**, if actually prioritised — net-new, simple lookup-table
   shape, not urgent relative to §2.

---

## 6. Do / Don't

**Do**
- Treat `project_assignments` as the schema to extend for visibility (§2),
  not a reason to design a new permission system from scratch.
- Keep `custom_role_title` explicitly cosmetic in any documentation or UI
  copy — don't let it silently become a permission concept.
- Decide the enum-vs-TEXT question for `user_role` deliberately before the
  next role is added (§3).
- Use `team.service.ts`'s double-enforcement + event-emission pattern as the
  template for any new admin-gated domain.

**Don't**
- Don't build a new RBAC framework before shipping §2 — the gap is a missing
  filter on an existing join, not a missing architecture.
- Don't assume `shipper` currently restricts anything — it doesn't, today.
- Don't add a new role value to the `user_role` enum without first deciding
  §3's TEXT+Zod migration question.
- Don't leave `requireVerified` half-wired — resolve it one way or the other.
