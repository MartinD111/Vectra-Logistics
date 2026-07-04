# Architecture

**Analysis Date:** 2026-07-04

## Pattern Overview

**Overall:** Monorepo with three independent Next.js frontend apps (Workspaces, Marketplace, CMR) + one shared Express backend (API), all accessed through a unified auth layer and cross-app navigation system.

**Key Characteristics:**
- **Workspace-scoped multi-tenancy** — All apps operate within a workspace context (company), with SSO cookie handling auth
- **Domain-Driven Design (DDD) backend** — API organized into ~20 independent domains (fleet, projects, kpi, billing, etc.), each with controller/service/repository layers
- **Notion-like project page canvas** — Phase 1 of Logistics OS; contentEditable blocks on grid layout; stored as JSONB in database
- **Mini Programs v2** — Block-based builder with generic processor pipeline (file input → transform → export); config-driven, plugin-extensible
- **Zero-downtime migration** — Legacy monolithic routes coexist with new DDD domain routes (/api/v1/*)

## Layers

**Frontend (apps/workspaces, apps/marketplace, apps/cmr):**
- Purpose: User-facing Next.js 14 apps; each focuses on a workspace surface area
- Location: `apps/{workspace|marketplace|cmr}/src`
- Contains: React components, Next.js app router pages, context/hooks, API client calls
- Depends on: `@vectra/ui`, `@vectra/api-client`, `@vectra/auth`, shared types
- Used by: End users via browser

**Backend API (apps/api):**
- Purpose: Central business logic and data access; shared by all three frontend apps
- Location: `apps/api/src`
- Contains: Express server, domain controllers/services/repositories, core infrastructure (auth, db, realtime, queue)
- Depends on: PostgreSQL, Redis, external services (Stripe, Outlook, AI APIs)
- Used by: All three frontend apps via HTTP/WebSocket

**Shared Packages (packages/*):**
- Purpose: Cross-app utilities and interfaces (UI components, auth, types, API client)
- Location: `packages/{ui|auth|api-client|types|data|config}`
- Contains: Reusable React components, shared TypeScript types, authentication helpers, HTTP client
- Used by: All frontend apps + backend for type safety

**Background Services:**
- **Matching Engine** (`services/matching-engine/`): Python service; LTL load matching algorithm
- **Queue Workers** (`apps/api/src/workers/`): BullMQ-backed async job processing
- **Realtime** (`apps/api/src/core/realtime/`): WebSocket via socket.io for live updates

## Data Flow

**User Page Request (Workspaces App):**

1. User navigates to `/dashboard` → Next.js routes to `apps/workspaces/src/app/(workspace)/dashboard/page.tsx`
2. Page component loads data via `@/lib/api/*.api.ts` (thin wrappers around `@vectra/api-client`)
3. Request hits API at `/api/v1/{domain}/*` with JWT in Authorization header
4. API middleware (`core/auth/middleware.ts`) validates token, extracts `companyId` + `userId`
5. Domain controller (e.g., `projects.controller.ts`) calls service layer
6. Service validates & transforms via Zod schemas, delegates to repository
7. Repository queries PostgreSQL, repository returns domain object
8. Service returns result, controller serializes as JSON
9. Frontend React Query caches response, component re-renders

**Project Page Edit (Canvas):**

1. User types "/" in rich-text block → `EditableRichText.tsx` detects "/" trigger
2. Slash menu opens with block types from `PAGE_BLOCK_REGISTRY` in `lib/projectPage/blocks.ts`
3. User selects block type → `LivePageCanvas` calls `pageBlockDef(kind).create()`
4. New block inserted into config array, `onChange(newConfig)` fired
5. Parent component debounces & POSTs updated config to `/api/v1/projects/:id/pages/:pageId`
6. API `projects.service.updatePage()` validates via `UpdatePageSchema`, saves to `project_pages.config`
7. WebSocket event published via `bus.emitToRoom()` → all connected users get live update

**Mini Program Execution (Builder):**

1. User in Program Builder (`components/miniProgram/`) assembles blocks (file input → transform → export)
2. Config stored as `MiniProgramConfig` JSONB in `programs.config`
3. Player loads config, renders blocks based on `BlockRegistry`
4. On "Run": runtime (`lib/miniProgram/runtime.tsx`) evaluates blocks sequentially
5. File input block produces `Row[]` dataset
6. Transform block rewrites rows via expression engine
7. Export block renders table or downloads file

**State Management:**

- **React Query** (`@tanstack/react-query`): Server state — API responses cached by URL
- **Context API** (`context/AuthContext.tsx`, `context/PlatformContext.tsx`): Auth user + sidebar state
- **Local state** (useState): Component UI state (edit mode, focus, menu open/close)
- **WebSocket (socket.io)** — Real-time updates published to rooms keyed on `projectId` or `companyId`

## Key Abstractions

**PageBlock Union Type:**
- Purpose: Represents any Notion-like block on a project page (text, heading, chart, kanban, etc.)
- Examples: `RichTextBlock`, `KpiGridBlock`, `FleetTelematicsBlock`, etc. in `apps/workspaces/src/lib/projectPage/blocks.ts`
- Pattern: Discriminated union on `kind` property; new blocks added by extending union, adding renderer, registering in `PAGE_BLOCK_REGISTRY`
- Registry: `PAGE_BLOCK_REGISTRY` — array of `PageBlockDef` metadata (title, description, factory, icon); used to build the slash menu palette

**MiniProgramConfig (v2):**
- Purpose: Generic, plugin-extensible pipeline for data processing (input → process → output)
- Location: `apps/workspaces/src/lib/miniProgram/blocks.ts`
- Pattern: Ordered array of blocks; each block has `kind`, optional `source` (points to prior block's output), and kind-specific config
- Runtime: Sequential evaluation; block output (dataset) flows into next block's input (unless `source` overrides)
- Plugins: Registry (`lib/miniProgram/plugins/registry.ts`) maps plugin ID → manifest → UI + evaluator

**Project & Program Domains:**
- Purpose: Encapsulate projects (containers), programs (mini program definitions), and pages (dashboard configs)
- Location: `apps/api/src/domains/projects/`
- Pattern: Service layer calls repository; repository writes/reads PostgreSQL; service applies business rules (ownership checks, event recording)
- Types: `Project`, `Program`, `ProjectPage` in `projects.types.ts`; DTOs for input validation in `dto/`

**Workspace Module System:**
- Purpose: Dynamically show/hide sidebar nav items based on `workspace.enabled_modules`
- Location: `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx`
- Pattern: `ITEMS` array maps module key (e.g., 'fleet', 'programs') to nav item; filter at render time based on `enabled` set
- Used by: Licensing/tenant config — different workspace types enable different modules

## Entry Points

**Workspaces App:**
- Location: `apps/workspaces/src/app/layout.tsx`
- Triggers: User navigates to `https://workspaces.vectra.local/`
- Responsibilities: 
  - Root `<html>` wrapper with globals CSS + Leaflet CSS
  - Wraps `<Providers>` (auth context, React Query, theme)
  - Renders `<Navbar>` (top app switcher) + `<AppShell>` (sidebar + main)
  - Nested app router groups under `(workspace)`, `(fleet)`, etc. for layout isolation

**API Server:**
- Location: `apps/api/src/server.ts`
- Triggers: `npm run dev` or deployed container starts
- Responsibilities:
  - Express server bootstrap (db/redis connect, middleware setup)
  - Mount domain routers at `/api/v1/{domain}`; legacy routes at `/api/{old-path}`
  - WebSocket via socket.io (auth, room join on first connect)
  - Background worker loop for async jobs

**CMR & Marketplace Apps:**
- Location: `apps/cmr/src/app/layout.tsx`, `apps/marketplace/src/app/layout.tsx`
- Triggers: User clicks cross-app link from Workspaces sidebar
- Responsibilities: Isolated Next.js apps; each has its own page routes and components, but reuse auth context and API client from workspaces

## Error Handling

**Strategy:** Centralized error class + global handler; errors propagate from repository → service → controller → middleware.

**Patterns:**

- **AppError class** (`apps/api/src/core/errors/AppError.ts`): Extends Error with `status` (HTTP code) and `message`
  ```typescript
  throw new AppError(404, 'Project not found');
  ```

- **Async handler wrapper** (`core/errors/asyncHandler.ts`): Wraps route handlers, catches async errors, passes to global handler

- **Global error handler** (`core/errors/errorHandler.ts`): Express middleware; serializes AppError to JSON response + logs

- **Validation with Zod**: Services call `schema.safeParse(body)` → throw AppError(400, issue message) on fail

- **Ownership checks**: Service methods call `assertOwnedProject(id, companyId)` → throw 403 if mismatch

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.log` for startup/health checks; structured logging not yet implemented
- Activity log: `recordEvent()` in `core/events/activityLog.ts` — audit trail in `activity_events` table, keyed by `tenantId`

**Validation:**
- Approach: Zod schemas in domain `dto/` folders; service layer parses before repo calls
- Example: `projects/dto/project.dto.ts` defines `CreateProjectSchema`, `UpdateProjectSchema`

**Authentication:**
- Approach: JWT in Authorization header (Bearer token); SSO cookie for session persistence
- Middleware: `authenticateToken()` in `core/auth/middleware.ts` extracts + verifies token; sets `req.user` + `req.companyId`
- All domain routes protected with `router.use(authenticateToken)`

**Realtime Updates:**
- Approach: WebSocket rooms keyed on `projectId` or `companyId`; service calls `bus.emitToRoom(room, event)` to broadcast
- Implementation: Socket.io with per-user namespacing; connection auth via JWT
- Used by: Page edits, activity feed, live chat

**Multi-tenancy:**
- Approach: Row-level security via `companyId` (workspace); all queries scoped to tenant
- JWT payload: includes `companyId`; every API request validates ownership before returning data
- Database: No schema-level multi-tenancy; isolation via WHERE clauses + middleware validation

---

*Architecture analysis: 2026-07-04*
