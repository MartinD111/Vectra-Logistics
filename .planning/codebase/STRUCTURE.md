# Codebase Structure

**Analysis Date:** 2026-07-04

## Directory Layout

```
vectra-platform/
├── apps/                       # Monorepo applications
│   ├── api/                    # Express backend (shared by all 3 apps)
│   │   ├── src/
│   │   │   ├── server.ts       # Entry point
│   │   │   ├── config/         # Env + config loading
│   │   │   ├── core/           # Shared infrastructure
│   │   │   │   ├── auth/       # JWT middleware
│   │   │   │   ├── db/         # PostgreSQL + Redis clients
│   │   │   │   ├── errors/     # Error handling
│   │   │   │   ├── events/     # Activity logging
│   │   │   │   ├── queue/      # BullMQ async jobs
│   │   │   │   └── realtime/   # WebSocket (socket.io)
│   │   │   ├── domains/        # DDD: each domain is self-contained
│   │   │   │   ├── projects/   # Projects, programs, pages
│   │   │   │   ├── fleet/      # Telematics, spotQuote, exceptions
│   │   │   │   ├── kpi/        # KPI computation + evaluators
│   │   │   │   ├── team/       # Team members + roles
│   │   │   │   ├── workspaces/ # Workspace config + modules
│   │   │   │   ├── billing/    # Invoicing + VAT
│   │   │   │   ├── ai/         # AI orchestration (ChatGPT, Gemini)
│   │   │   │   └── [13 more]   # inbox, yard, pod, ltl, etc.
│   │   │   ├── controllers/    # Legacy monolithic (migrate to domains)
│   │   │   ├── routes/         # Legacy monolithic routes
│   │   │   ├── middleware/     # Legacy middleware
│   │   │   ├── services/       # Shared services (not domain-owned)
│   │   │   └── workers/        # Background job runners
│   │   ├── dist/               # Compiled output (git-ignored)
│   │   ├── package.json        # @vectra/api
│   │   └── tsconfig.json
│   │
│   ├── workspaces/             # Next.js 14: main SaaS app
│   │   ├── src/
│   │   │   ├── app/            # Next.js app router
│   │   │   │   ├── layout.tsx  # Root layout
│   │   │   │   ├── (workspace)/ # Protected routes (auth required)
│   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   ├── projects/page.tsx
│   │   │   │   │   ├── automations/page.tsx
│   │   │   │   │   ├── fleet/page.tsx
│   │   │   │   │   └── [other workspace-scoped pages]
│   │   │   │   ├── (fleet)/    # Fleet-specific routes (layout isolated)
│   │   │   │   ├── (marketplace)/ # Marketplace-specific routes
│   │   │   │   ├── (routes)/   # Routes/automations routes
│   │   │   │   ├── auth/       # Public auth routes
│   │   │   │   └── [other public pages]
│   │   │   ├── components/     # React components
│   │   │   │   ├── layout/     # AppShell, Navbar, Sidebar, Providers
│   │   │   │   ├── projectPage/  # Notion-like canvas blocks
│   │   │   │   ├── miniProgram/  # Block-based program builder/player
│   │   │   │   ├── automations/  # Campaign, rate parser, etc.
│   │   │   │   ├── folders/      # Folder tree
│   │   │   │   ├── documents/    # Document viewer
│   │   │   │   ├── settings/     # Workspace config UI
│   │   │   │   └── [other feature components]
│   │   │   ├── context/        # React Context API
│   │   │   │   ├── AuthContext.tsx  # Auth user state
│   │   │   │   └── PlatformContext.tsx # Sidebar open/close
│   │   │   ├── lib/            # Utilities & client-side logic
│   │   │   │   ├── api/        # API client helpers
│   │   │   │   │   ├── client.ts      # Re-export of @vectra/api-client
│   │   │   │   │   ├── projects.api.ts
│   │   │   │   │   ├── fleet.api.ts
│   │   │   │   │   └── [13 more domain APIs]
│   │   │   │   ├── hooks/      # Custom React hooks
│   │   │   │   ├── projectPage/  # Project page canvas logic
│   │   │   │   │   ├── blocks.ts      # PageBlock types + registry
│   │   │   │   │   ├── slashMenu.ts   # Slash command menu
│   │   │   │   │   └── templates.ts
│   │   │   │   ├── miniProgram/  # Mini program v2
│   │   │   │   │   ├── blocks.ts      # Block kinds + types
│   │   │   │   │   ├── runtime.tsx    # Execution engine
│   │   │   │   │   ├── plugins/       # Plugin system
│   │   │   │   │   │   ├── registry.ts
│   │   │   │   │   │   ├── manifest.ts
│   │   │   │   │   │   └── sandbox.ts
│   │   │   │   │   ├── generator.ts
│   │   │   │   │   └── templates.ts
│   │   │   │   ├── programBuilder/  # Mini program config schema
│   │   │   │   ├── omniDocs/       # Document generation
│   │   │   │   └── [other utils]
│   │   ├── public/             # Static assets (favicon, icons)
│   │   ├── package.json        # @vectra/workspaces
│   │   └── tsconfig.json
│   │
│   ├── cmr/                    # Next.js 14: CMR (Carnet de Route) manager
│   │   ├── src/                # Same structure as workspaces
│   │   ├── public/
│   │   ├── package.json        # @vectra/cmr
│   │   └── tsconfig.json
│   │
│   └── marketplace/            # Next.js 14: Marketplace intelligence
│       ├── src/                # Same structure as workspaces
│       ├── public/
│       ├── package.json        # @vectra/marketplace
│       └── tsconfig.json
│
├── packages/                   # Shared libraries (workspaces)
│   ├── ui/                     # Shared React components + utilities
│   │   ├── src/
│   │   │   ├── index.ts        # Barrel export
│   │   │   ├── AppProviders.tsx   # Context wrappers
│   │   │   ├── AppSwitcher.tsx    # Cross-app nav
│   │   │   ├── Navbar.tsx         # Top bar
│   │   │   ├── appUrls.ts         # URL helpers (crossAppUrl, etc.)
│   │   │   └── [other shared UI]
│   │   ├── package.json        # @vectra/ui
│   │   └── tsconfig.json
│   │
│   ├── api-client/             # Shared HTTP client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── apiFetch.ts     # Fetch wrapper + error handling
│   │   │   └── [types]
│   │   ├── package.json        # @vectra/api-client
│   │   └── tsconfig.json
│   │
│   ├── auth/                   # Auth utilities (SSO, JWT)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── [auth helpers]
│   │   ├── package.json        # @vectra/auth
│   │   └── tsconfig.json
│   │
│   ├── types/                  # Shared TypeScript interfaces
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── [global types]
│   │   ├── package.json        # @vectra/types
│   │   └── tsconfig.json
│   │
│   ├── data/                   # Data layer (Leaflet, @vectra/data isolation)
│   │   ├── src/
│   │   ├── package.json        # @vectra/data
│   │   └── tsconfig.json
│   │
│   └── config/                 # Build/env config (mostly empty, for monorepo)
│       └── package.json        # @vectra/config
│
├── database/                   # PostgreSQL migrations + schema
│   └── migrations/             # Numbered .sql files for Flyway or similar
│
├── services/                   # Standalone services
│   └── matching-engine/        # Python: LTL load matching algorithm
│       ├── core/
│       └── [Python source]
│
├── docs/                       # Documentation (Notion exports, etc.)
├── .planning/                  # GSD planning artifacts
│   └── codebase/              # This folder: ARCHITECTURE.md, STRUCTURE.md, etc.
├── package.json               # Root monorepo (workspaces = [apps/*, packages/*])
├── tsconfig.json              # Root TS config (base for all apps/packages)
└── [git, env, dotfiles]
```

## Directory Purposes

**apps/api/src:**
- Purpose: Single Express backend serving all 3 frontend apps
- Entry: `server.ts` — Express setup, domain router mounting, WebSocket config
- Core infra: `core/` — database, auth, errors, events, queue, realtime (shared by all domains)
- Business logic: `domains/` — 20+ independent domains; each has controller/service/repository + DTOs
- Legacy code: `controllers/`, `routes/`, `middleware/` — being migrated domain-by-domain
- Built for: `npm run build` → `dist/` (git-ignored); run with `npm start`

**apps/workspaces/src:**
- Purpose: Next.js 14 app; main SaaS workspace UI
- Entry: `app/layout.tsx` — root page layout, Providers, Navbar, AppShell
- Pages: `app/` routes under `(workspace)/`, `(fleet)/`, etc. groups for layout isolation
- Components: Feature-grouped directories (projectPage, miniProgram, etc.) — each dir has multiple .tsx files for related UI
- Logic: `lib/` — client-side business logic (API wrappers, mini program runtime, page block registry)
- Contexts: `context/` — global state (auth user, sidebar open/close)
- Dev: `npm run dev` → localhost:3001; production via `npm run build` + `npm start`

**apps/cmr, apps/marketplace:**
- Purpose: Isolated Next.js apps; CMR tracks courier journeys, Marketplace analyzes freight rates
- Structure: Identical to workspaces (app router, components, lib, context)
- Shared: Use same `@vectra/api-client`, `@vectra/auth`, `@vectra/ui` packages; same API backend
- Linked: Cross-app nav in sidebar; linked via `@vectra/ui/appUrls.ts` helpers

**packages/ui:**
- Purpose: Shared React component library + utilities (theme, layouts, helpers)
- Used by: All 3 frontend apps + backend TypeScript codegen
- Exports: `AppProviders`, `AppSwitcher`, `Navbar`, `crossAppUrl()`, and theme configuration

**packages/api-client:**
- Purpose: HTTP client wrapper for all API calls (fetch + auth + error handling)
- Used by: All 3 frontend apps; imported at `@/lib/api/client.ts` (symlinked)
- Pattern: `apiFetch(url, options)` — attaches JWT from context, sets headers, handles errors

**packages/auth:**
- Purpose: SSO cookie verification, JWT helpers
- Used by: Frontend (useAuth hook), backend (authenticateToken middleware)

**packages/types:**
- Purpose: Shared TypeScript interfaces (User, Project, Program, PageBlock, etc.)
- Used by: All 3 apps + backend; single source of truth for type contracts

**packages/data:**
- Purpose: Leaflet map isolation layer (not fully detailed in this scan; reserved for map data)
- Used by: Fleet, yard, and other geo-spatial features

**database/migrations:**
- Purpose: PostgreSQL schema changes tracked in version control
- Format: Numbered SQL files (e.g., `001_create_projects.sql`)
- Run by: Backend bootstrap or CI/CD pipeline

**services/matching-engine:**
- Purpose: Python service; standalone LTL (less-than-truckload) load matching
- Called by: Backend via subprocess or HTTP; scheduled jobs via queue
- Input: Active shipments + available trucks
- Output: Recommended load assignments ranked by margin

## Key File Locations

**Entry Points:**

- Backend: `apps/api/src/server.ts` — Express bootstrap, domain router mount, WebSocket setup
- Workspaces: `apps/workspaces/src/app/layout.tsx` — Root HTML, Providers, AppShell
- CMR: `apps/cmr/src/app/layout.tsx`
- Marketplace: `apps/marketplace/src/app/layout.tsx`

**Authentication & Authorization:**

- Backend middleware: `apps/api/src/core/auth/middleware.ts` — JWT extraction + companyId validation
- Frontend context: `apps/workspaces/src/context/AuthContext.tsx` — User + tokens
- Sidebar visibility: `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx` — Module-gated nav

**Project Pages (Notion-like Canvas):**

- Block types + registry: `apps/workspaces/src/lib/projectPage/blocks.ts` — PageBlockKind union, PAGE_BLOCK_REGISTRY
- Live editor: `apps/workspaces/src/components/projectPage/LivePageCanvas.tsx` — Drag, edit, slash menu
- Renderers: `apps/workspaces/src/components/projectPage/PageBlockView.tsx` — Read-only render
- Block-specific renderers: `apps/workspaces/src/components/projectPage/{Kind}Block.tsx` (e.g., KpiGridBlock.tsx)
- Settings UI: `apps/workspaces/src/components/projectPage/PageBlockSettings.tsx` — Config panel

**Mini Programs v2:**

- Block types: `apps/workspaces/src/lib/miniProgram/blocks.ts` — BlockKind union (file-input, transform, export, etc.)
- Runtime: `apps/workspaces/src/lib/miniProgram/runtime.tsx` — Sequential block evaluation
- Plugin system: `apps/workspaces/src/lib/miniProgram/plugins/` — Registry, manifest, sandbox
- Builder: `apps/workspaces/src/components/miniProgram/` — Drag-drop block assembly
- Player: `apps/workspaces/src/components/miniProgram/` — Read-only execution UI

**API Domains:**

- Projects/programs/pages: `apps/api/src/domains/projects/` — Controller/Service/Repository + DTOs
- Fleet: `apps/api/src/domains/fleet/` — Telematics, exceptions, spot quote
- KPI: `apps/api/src/domains/kpi/` — Computation, evaluators
- Workspace config: `apps/api/src/domains/workspaces/` — Enabled modules, workspace types
- [13 more domains listed in domains/index.ts]

**Error Handling:**

- Custom error class: `apps/api/src/core/errors/AppError.ts`
- Global handler: `apps/api/src/core/errors/errorHandler.ts` — Catches + serializes
- Async wrapper: `apps/api/src/core/errors/asyncHandler.ts` — Wraps route handlers

**Real-time & Events:**

- WebSocket: `apps/api/src/core/realtime/` — socket.ts (auth + rooms), bus.ts (pub/sub)
- Activity log: `apps/api/src/core/events/activityLog.ts` — recordEvent() function

**Shared Utilities:**

- Cross-app URLs: `packages/ui/src/appUrls.ts` — crossAppUrl('cmr', '/path')
- API client: `packages/api-client/src/apiFetch.ts` — Shared HTTP wrapper

## Naming Conventions

**Files:**

- Page: `{feature}.page.tsx` (e.g., `dashboard.page.tsx`)
- Component: `{Feature}.tsx` (PascalCase, single file per component)
- Service: `{domain}.service.ts` (singular, snake_case)
- Repository: `{domain}.repository.ts`
- Routes: `{domain}.routes.ts`
- DTOs: `{entity}.dto.ts`
- Types: `{domain}.types.ts`
- Utils: `{feature}.utils.ts` or `{feature}.helpers.ts`
- Hooks: `use{Feature}.ts` (camelCase, useXxx convention)
- API client: `{domain}.api.ts` (thin wrappers in `lib/api/`)

**Directories:**

- Feature groups: lowercase, plural (e.g., `components/projectPage/`, `lib/miniProgram/`)
- Cross-cutting: lowercase (e.g., `core/auth/`, `core/errors/`)
- Domain directories: lowercase, singular (e.g., `domains/fleet/`, `domains/kpi/`)
- Organized by domain, not by type (services/ dir avoided; grouped under domain)

**TypeScript/React:**

- Union types: PascalCase + Kind suffix (e.g., `PageBlockKind`, `BlockKind`)
- Interfaces: PascalCase, no `I` prefix (e.g., `PageBlock`, `Project`)
- Enum: PascalCase (e.g., `WorkspaceType`)
- Constants: UPPER_SNAKE_CASE (e.g., `PAGE_BLOCK_REGISTRY`, `SPAN_COLS`)
- Functions: camelCase (e.g., `createProject()`, `updateBlock()`)
- React component props: PascalCase interface ending in `Props` (e.g., `PageBlockViewProps`)

## Where to Add New Code

**New Feature (e.g., "Proof of Delivery Tracker"):**

1. **Backend:**
   - Create `apps/api/src/domains/pod/` (if not exists)
   - Add controller: `pod.controller.ts` with route handlers
   - Add service: `pod.service.ts` with business logic + validation
   - Add repository: `pod.repository.ts` with SQL queries
   - Add types: `pod.types.ts` with domain objects
   - Add DTOs: `dto/` folder with Zod schemas
   - Add routes: `pod.routes.ts`, import + mount in `domains/index.ts`
   - Example: `PodTrackerBlock` in `projectPage/blocks.ts` already defined (Phase 5)

2. **Frontend (Workspaces):**
   - Create renderer: `apps/workspaces/src/components/projectPage/PodTrackerBlock.tsx`
   - Create settings UI: add to `PageBlockSettings.tsx` or separate `PodTrackerBlockSettings.tsx`
   - Create API wrapper: `apps/workspaces/src/lib/api/pod.api.ts` (apiFetch calls)
   - Add hook: `apps/workspaces/src/lib/hooks/usePodTracker.ts` for data fetching
   - Register renderer in component switch statement

3. **Mini Program Block (if part of pipeline):**
   - Extend `BlockKind` union in `apps/workspaces/src/lib/miniProgram/blocks.ts`
   - Create block type interface (e.g., `PodUploadBlock`)
   - Create renderer: `apps/workspaces/src/components/miniProgram/PodUploadBlock.tsx`
   - Register in `BlockRegistry`

**New Domain (Clean separation):**

- Mkdir `apps/api/src/domains/{newdomain}/`
- Create: `{newdomain}.routes.ts`, `{newdomain}.controller.ts`, `{newdomain}.service.ts`, `{newdomain}.repository.ts`, `{newdomain}.types.ts`
- Create: `dto/` with Zod schemas
- Mount router in `apps/api/src/domains/index.ts`: `router.use('/{newdomain}', {newdomain}Router)`
- All routes auto-protected by `authenticateToken` in parent group

**Utilities & Shared Helpers:**

- **Frontend client-side logic:** `apps/workspaces/src/lib/{feature}.ts`
- **Backend business logic:** Keep in domain service; avoid top-level `services/` dir
- **Shared types:** Add to `packages/types/src/` if used across multiple apps/domains
- **Shared UI components:** Add to `packages/ui/src/` if reused in multiple apps

**Testing (When test suite is added):**

- Co-locate test next to source: `SomeComponent.tsx` → `SomeComponent.test.tsx`
- Backend: `{domain}.service.test.ts` next to `{domain}.service.ts`
- Example: `projects.service.test.ts` → `projects.service.ts`

## Special Directories

**apps/*/public:**
- Purpose: Static assets (favicon, logos, social meta images)
- Generated: No
- Committed: Yes; served directly by Next.js

**.next, dist, node_modules:**
- Purpose: Build artifacts and dependencies
- Generated: Yes (build time)
- Committed: No (git-ignored)

**database/migrations:**
- Purpose: Schema versioning
- Generated: No (manually authored SQL)
- Committed: Yes; run sequentially on deploy

**.planning/codebase:**
- Purpose: GSD mappers write architecture/structure/conventions docs here
- Generated: Yes (by /gsd-map-codebase)
- Committed: Yes; consumed by /gsd-plan-phase and /gsd-execute-phase

---

*Structure analysis: 2026-07-04*
