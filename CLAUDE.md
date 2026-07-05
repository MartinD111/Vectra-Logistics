<!-- GSD:project-start source:PROJECT.md -->
## Project

**Vectra CRM Rework**

A dedicated CRM module inside the Vectra workspaces app, replacing the never-built "Records" sidebar slot. Today the CRM exists only as a `crm-clients` block embedded inside project pages — a client list with a credit-limit bar and an inline add-client form, nothing more. This rework gives clients a proper home: a CRM dashboard, full client detail pages (opened in a new tab), bulk Excel import, per-project overrides, real email history synced from Outlook, and a credit-risk semaphore wired into the KPI engine that hard-blocks dispatchers from assigning loads to over-limit clients.

**Core Value:** Dispatchers must never be able to assign a load to a client who is over their credit limit or has a bad payment history — the risk semaphore is a hard, visible block, not a suggestion.

### Constraints

- **Existing 403 behavior**: The backend already blocks over-limit assignments at the API level — the new semaphore must visually reflect this, not introduce a second enforcement path — Why: avoid duplicate/conflicting business logic between old and new code.
- **No ORM**: All schema changes go through new idempotent SQL migration files following the existing `NNN_description.sql` convention — Why: matches established project convention, no Prisma/ORM in use.
- **Reuse over rebuild**: Excel import should reuse the existing `xlsx` package/pattern from `ExcelAutomationTool.tsx`; new-tab navigation should reuse `crossAppUrl`/existing link patterns — Why: consistency, less new surface area.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.3.2 - All backend API and frontend app code (`apps/api/src`, `apps/*/src`)
- JavaScript (TSX/JSX) - React components and Next.js pages (`apps/*/src`)
- Python 3.11 - LTL matching engine microservice (`services/matching-engine/`)
- SQL - PostgreSQL migrations and database schemas (`database/migrations/`)
- Bash/Shell - Docker entrypoints and build scripts
## Runtime
- Node.js (version unspecified, inferred 18+ from package.json targets)
- Python 3.11 - For matching-engine microservice
- npm (workspace monorepo)
- Lockfiles: `package-lock.json` present in root and per-app; pinned Python dependencies in `requirements.txt`
## Frameworks
- Express.js 4.18.2 - REST API server (`apps/api/src/server.ts`)
- Socket.io 4.7.2 - Real-time websocket communication for realtime features
- TypeScript 5.3 - Backend type safety
- Next.js 14.0.3 - Three frontend apps (Marketplace, Workspaces, CMR)
- React 18 - UI component library
- TailwindCSS 3.3.0 - Styling (all frontend apps)
- FastAPI 0.104.1 - Python async HTTP framework for matching engine (`services/matching-engine/main.py`)
- Uvicorn 0.24.0 - ASGI web server for matching engine
- TanStack React Query 5.99.2 - Server state management and caching (all frontend apps)
- Zod 4.3.6 - TypeScript-first schema validation (`apps/api/src/domains/*/dto/`)
- Pydantic 2.5.2 - Python data validation in matching engine
## Key Dependencies
- `pg` 8.11.3 - PostgreSQL client for Node.js
- `redis` 4.6.10 - Redis client for caching and pub/sub
- `express` 4.18.2 - HTTP server framework
- `jsonwebtoken` 9.0.3 - JWT token signing/verification for auth
- `socket.io` 4.7.2 - Real-time bidirectional communication
- `socket.io-client` 4.7.2 - Client-side socket connection (all frontend apps)
- `axios` 1.6.2 - HTTP client for internal service calls
- `bullmq` 5.76.0 - Redis-based task queue for async jobs (matching engine worker)
- `redis` 5.0.1 (Python) - Redis client for matching engine
- `@google/generative-ai` 0.24.1 - Google Gemini API client for AI completions
- `pdfkit` 0.14.0 - PDF generation for documents
- `html2canvas` 1.4.1 - HTML-to-canvas rendering (Workspaces, CMR)
- `jspdf` 4.2.0 - PDF export (Workspaces, CMR)
- `dompurify` 3.3.3 - XSS sanitization (Workspaces, CMR)
- `recharts` 3.9.1 - React chart library (Workspaces only)
- `leaflet` 1.9.4 - Map rendering library (Marketplace, Workspaces)
- `react-leaflet` 4.2.1 - React wrapper for Leaflet (Marketplace, Workspaces)
- `lucide-react` 0.294.0 - Icon library (all frontend apps)
- `@dnd-kit/*` (core 6.3.1, sortable 10.0.0, modifiers 9.0.0) - Drag-and-drop (Workspaces)
- `next-themes` 0.4.6 - Dark mode theme provider (all frontend apps)
- `xlsx` 0.18.5 - Excel spreadsheet generation (Workspaces, CMR)
- `jszip` 3.10.1 - ZIP file creation (Workspaces)
- `canvg` 4.0.3 - Canvas/SVG rendering (Workspaces)
- `multer` 2.1.1 - File upload middleware
- `bcrypt` 6.0.0 - Password hashing
- `uuid` 9.0.1 - UUID generation
- `cors` 2.8.5 - CORS middleware
- `dotenv` 16.3.1 - Environment variable loading
- `idb-keyval` 6.2.2 - IndexedDB key-value store wrapper (Workspaces)
- `@vectra/api-client` - HTTP client wrapper for API calls (shared package)
- `@vectra/auth` - Authentication logic and hooks (shared package)
- `@vectra/data` - Realtime socket, notifications, document components (shared package)
- `@vectra/types` - TypeScript type definitions (shared package)
- `@vectra/ui` - Reusable React components (shared package)
- `@vectra/config` - Configuration exports (shared package)
## Configuration
- `.env.example` - Example configuration template (present)
- Environment variables loaded via `dotenv` package
- Configuration per service: API, Redis, PostgreSQL, JWT, cross-app URLs, AI providers, Microsoft OAuth
- `tsconfig.json` - TypeScript compiler config (`apps/api/tsconfig.json`)
- `next.config.mjs` - Next.js config (`apps/workspaces/next.config.mjs`, similar in other apps)
- `tailwind.config.ts` - Tailwind CSS config (all frontend apps)
- `postcss.config.js` - PostCSS config (all frontend apps)
- ESLint config (`.eslintrc.json` in frontend apps, minimal)
- `Dockerfile` (API backend) - Node.js production build
- `Dockerfile` (Frontend apps) - Multi-stage Next.js production builds
- `Dockerfile.web.dev` - Development image for all frontend apps
- `Dockerfile` (matching-engine) - Python slim base with uvicorn
- `docker-compose.yml` - Full stack orchestration with 6 services
## Platform Requirements
- Node.js 18+ (inferred from package.json)
- npm workspace support
- Docker & Docker Compose (for local database/redis/services)
- PostgreSQL 15 (in container)
- Redis 7 (in container)
- Python 3.11 (for matching-engine development)
- Docker container orchestration (Kubernetes, Docker Swarm, or cloud platform)
- PostgreSQL 15+ managed database
- Redis 7+ managed cache/queue
- Node.js 18+ runtime
- Python 3.11 runtime (for matching-engine)
- SSL/TLS certificate for HTTPS
- DNS configured for three frontend subdomains (marketplace, workspaces, cmr) or single domain with path-based routing
- Containerized: All services ship as Docker images
- Monorepo deployment: Single docker build context with multi-stage Dockerfiles
- Cross-app SSO: Shared cookie domain (configurable via `NEXT_PUBLIC_COOKIE_DOMAIN`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Services: `[domain].service.ts` (e.g., `ai.service.ts`, `billing.service.ts`)
- Repositories: `[domain].repository.ts` (e.g., `ai.repository.ts`, `fleet.repository.ts`)
- Controllers: `[domain].controller.ts` (e.g., `ai.controller.ts`, `billing.controller.ts`)
- Routes: `[domain].routes.ts` (e.g., `ai.routes.ts`, `workspace.routes.ts`)
- Types: `[domain].types.ts` (e.g., `ai.types.ts`, `billing.types.ts`)
- DTOs: kebab-case in `/dto/` folder (e.g., `save-ai-config.dto.ts`, `create-driver.dto.ts`)
- React components: PascalCase (e.g., `AppShell.tsx`, `BlockView.tsx`, `WorkspaceSidebar.tsx`)
- React hooks: camelCase with `use` prefix (e.g., `useProjects.ts`, `useAi.ts`, `useLtl.ts`)
- API module files: camelCase with `.api.ts` suffix (e.g., `projects.api.ts`, `fleet.api.ts`)
- SQL migrations: sequential numbered files `NNN_description.sql` (e.g., `005_ai_config.sql`, `020_ltl_matching.sql`)
- camelCase (e.g., `getAiConfig`, `saveConfig`, `completeOpenAi`)
- Handler functions: descriptive names starting with verb (e.g., `getAiConfig`, `saveAiConfig`, `completeAi`, `translateAi`)
- Async functions: standard `async` keyword, never callback-based
- Private methods: prefix with underscore `_methodName` or use JavaScript `#` private fields
- Service class methods: camelCase, public (e.g., `getConfig`, `saveConfig`, `hasCloudProvider`, `complete`)
- camelCase for local scope (e.g., `companyId`, `apiKey`, `localEndpoint`)
- snake_case for database columns and row objects (e.g., `api_key_enc`, `company_id`, `updated_at`)
- UPPERCASE for constants (e.g., `DEFAULT_MODEL`, `NO_SIDEBAR`)
- Query keys (React Query): object notation with const suffix `qk` (e.g., `qk.projects`, `qk.activity(id)`)
- Interfaces for public API contracts and row objects (e.g., `AiConfigPublic`, `AiConfigRow`, `Project`)
- Types for DTO objects inferred from Zod schemas (e.g., `SaveAiConfigDto = z.infer<typeof SaveAiConfigSchema>`)
- Union types for enumerations (e.g., `AiProvider = 'openai' | 'gemini' | 'local'`)
- `Dto` suffix for request/response schema types (e.g., `CreateDriverDto`, `UpdateVehicleDto`)
## Code Style
- No Prettier config enforced; code follows implicit convention
- Line length: ~100–120 characters typical (see `ai.service.ts` for reference)
- Trailing commas in multi-line arrays/objects
- Single quotes for strings in JS/TS, double quotes in HTML/JSX attributes
- ESLint config: `extends: "next/core-web-vitals"` in `apps/workspaces/.eslintrc.json`
- API app: TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- No other linting config detected in API app; relies on TypeScript strictness
- Target: `es2022`
- `strict: true` enforced in API
- Type annotations explicit on function parameters and return types
- No `any` type usage observed; types are fully specified
## Import Organization
- Frontend (`apps/workspaces`): `@/` points to `src/` (Next.js standard)
- Shared packages: `@vectra/api-client`, `@vectra/auth`, `@vectra/data`, `@vectra/types`, `@vectra/ui`
- No path aliases in API app (`apps/api`); relative imports used exclusively
## Error Handling
- Custom `AppError` class extending `Error` with `status: number` property (see `apps/api/src/core/errors/AppError.ts`)
- Throw `AppError` with HTTP status and user-facing message: `throw new AppError(400, 'message')`
- Status codes: 400 for validation, 403 for authorization, 404 for not found, 502 for external service failures
- `asyncHandler` wrapper for Express handlers (see `apps/api/src/core/errors/asyncHandler.ts`) — catches promise rejections and passes to `errorHandler`
- Global error handler (see `apps/api/src/core/errors/errorHandler.ts`): logs unhandled errors, returns JSON error response
- Validation errors: use Zod `.safeParse()`, extract error message from first issue: `parsed.error.issues[0].message`
- External API errors: normalize provider errors into `AppError` without leaking secrets (see `ai.service.ts` `providerError` method)
## Logging
- Prefix error logs with context: `console.error('Auth error:', err)` or `console.error('[Unhandled]', err)`
- Info logs for service startup: `console.log('PostgreSQL connected')`
- No production-level log levels (debug, warn, info) enforced; console methods used directly
- Errors from external services must be sanitized before logging (API keys must never appear in logs)
## Comments
- Explain business logic complexity (e.g., "Cloud key: encrypt when provided, keep existing when omitted..." in `ai.service.ts`)
- Explain non-obvious design decisions (e.g., "Local providers are called directly from the browser, not via the server proxy")
- Database migration comments: describe table purpose, column constraints, and migration sequencing
- TODO comments for incomplete features (see `apps/api/src/domains/integrations/integrations.service.ts` for `TODO: Replace stub with real...`)
- No over-commenting; prefer self-documenting code with clear function/variable names
- Minimal JSDoc usage observed; when present, document public methods with inline block comments
- Example: `/** Upsert config. ... */` in repository methods
- Type annotations serve as documentation; JSDoc not heavily relied upon
## Function Design
- Typical range: 20–50 lines for service methods
- Larger methods (100+ lines) are feature-focused (e.g., `automation.service.ts` 352 lines for invoice parsing workflow)
- Controller handlers: 1–3 lines (delegate to service immediately)
- Request/response pairs in Express handlers: `(req: AuthRequest, res: Response, next?: NextFunction)`
- Service methods take domain objects and primitives: `async getConfig(companyId: string)`
- DTO objects passed via `req.body` after validation: `saveConfig(companyId: string, body: unknown, userId: string | null)`
- Optional trailing parameters use `?` or overloads (e.g., `useProjectActivity(id: string, limit = 20)`)
- Async methods return typed objects: `Promise<AiConfigPublic>`
- Controllers return `void` (status set via `res.status().json()`)
- Services return domain objects or primitive results
- Nullable results: return `| null` (e.g., `Promise<AiConfigRow | null>`)
## Module Design
- Singleton instances of services/repositories exported: `export const aiService = new AiService()` (not classes, instances)
- Controller functions exported as named exports: `export const getAiConfig = asyncHandler(...)`
- Routes file exports default Router: `export default router`
- API module files export interfaces + fetch functions: `export interface Project { ... }` then `export async function list()`
- React hooks exported as named exports: `export function useProjectActivity(...)`
- Root domain barrel: `apps/api/src/domains/index.ts` exports all domain routers
- No component barrel files observed; components imported directly by path
- API module files are not barrels; each domain has its own `[domain].api.ts` file
## SQL Conventions
- Idempotency: `CREATE TABLE IF NOT EXISTS` and `CREATE EXTENSION IF NOT EXISTS`
- Naming: sequential numbered `NNN_description.sql` (001, 002, 003, etc.)
- Header comments: purpose, sequencing, and idempotency guarantee
- Column naming: snake_case (e.g., `company_id`, `api_key_enc`, `updated_at`)
- Timestamps: `TIMESTAMPTZ` with `DEFAULT NOW()` for audit trails
- Foreign keys: explicit `REFERENCES table(column) ON DELETE CASCADE/SET NULL`
- Encrypted fields suffix: `_enc` (e.g., `api_key_enc` for AES-256-GCM envelope)
- Boolean/status columns: `TEXT` type with enum values (e.g., `'open'`, `'matched'`, `'dismissed'`)
- Indexes: explicit `CREATE INDEX IF NOT EXISTS` for query optimization
## Domain Organization
- `[domain].controller.ts` — HTTP request handlers, parameter extraction, status codes
- `[domain].service.ts` — business logic, external API calls, orchestration
- `[domain].repository.ts` — database queries, ORM, data access
- `[domain].types.ts` — domain-specific interfaces and types
- `[domain].routes.ts` — Express Router, middleware, endpoint definitions
- `dto/` subdirectory — Zod schemas and DTO types for request validation
- Controller: extract/validate input, call service, return response
- Service: orchestrate business logic, manage transactions, call external APIs
- Repository: database queries only, return raw database rows
- Routes: define endpoints and middleware order (auth, role checks)
- Controller (`ai.controller.ts`) handles `/config` GET/POST via `requireCompany` middleware
- Service (`ai.service.ts`) encrypts API keys, calls OpenAI/Gemini, manages provider selection
- Repository (`ai.repository.ts`) manages `company_ai_config` table with upsert logic
- DTO (`dto/save-ai-config.dto.ts`) defines `SaveAiConfigSchema` Zod validator
- Routes (`ai.routes.ts`) registers endpoints with auth + role middleware
## React/Next.js Patterns
- All components marked `'use client'` at top (client-side rendering)
- Functional components with hooks
- Type definitions inline or in interfaces at file top
- Props typed with `{ prop: Type }` parameter syntax
- Child elements typed as `ReactNode` or `PropsWithChildren`
- React Query (`@tanstack/react-query`) for server state: `useQuery`, `useMutation`
- Context API for app state: `useAuth()`, `usePlatform()`
- Local state via `useState` for form fields and UI state
- No Redux or Zustand observed
- Centralized query key factory with `as const` for type safety
- Example: `const qk = { projects: ['projects'] as const, project: (id: string) => ['projects', id] as const }`
- Nested structure mirrors domain hierarchy
- Custom hooks in `apps/workspaces/src/lib/hooks/use[Domain].ts`
- Hooks wrap React Query operations and API calls
- Hooks check `enabled: !!user?.company_id && !!id` for conditional execution
- Return `useQuery` result directly (includes `data`, `isLoading`, `error`)
- API functions in `apps/workspaces/src/lib/api/[domain].api.ts`
- Interfaces for API response shapes co-located with fetch functions
- No type duplication; interfaces defined once per domain
- Fetch via `apiFetch` client from `@vectra/api-client` shared package
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Workspace-scoped multi-tenancy** — All apps operate within a workspace context (company), with SSO cookie handling auth
- **Domain-Driven Design (DDD) backend** — API organized into ~20 independent domains (fleet, projects, kpi, billing, etc.), each with controller/service/repository layers
- **Notion-like project page canvas** — Phase 1 of Logistics OS; contentEditable blocks on grid layout; stored as JSONB in database
- **Mini Programs v2** — Block-based builder with generic processor pipeline (file input → transform → export); config-driven, plugin-extensible
- **Zero-downtime migration** — Legacy monolithic routes coexist with new DDD domain routes (/api/v1/*)
## Layers
- Purpose: User-facing Next.js 14 apps; each focuses on a workspace surface area
- Location: `apps/{workspace|marketplace|cmr}/src`
- Contains: React components, Next.js app router pages, context/hooks, API client calls
- Depends on: `@vectra/ui`, `@vectra/api-client`, `@vectra/auth`, shared types
- Used by: End users via browser
- Purpose: Central business logic and data access; shared by all three frontend apps
- Location: `apps/api/src`
- Contains: Express server, domain controllers/services/repositories, core infrastructure (auth, db, realtime, queue)
- Depends on: PostgreSQL, Redis, external services (Stripe, Outlook, AI APIs)
- Used by: All three frontend apps via HTTP/WebSocket
- Purpose: Cross-app utilities and interfaces (UI components, auth, types, API client)
- Location: `packages/{ui|auth|api-client|types|data|config}`
- Contains: Reusable React components, shared TypeScript types, authentication helpers, HTTP client
- Used by: All frontend apps + backend for type safety
- **Matching Engine** (`services/matching-engine/`): Python service; LTL load matching algorithm
- **Queue Workers** (`apps/api/src/workers/`): BullMQ-backed async job processing
- **Realtime** (`apps/api/src/core/realtime/`): WebSocket via socket.io for live updates
## Data Flow
- **React Query** (`@tanstack/react-query`): Server state — API responses cached by URL
- **Context API** (`context/AuthContext.tsx`, `context/PlatformContext.tsx`): Auth user + sidebar state
- **Local state** (useState): Component UI state (edit mode, focus, menu open/close)
- **WebSocket (socket.io)** — Real-time updates published to rooms keyed on `projectId` or `companyId`
## Key Abstractions
- Purpose: Represents any Notion-like block on a project page (text, heading, chart, kanban, etc.)
- Examples: `RichTextBlock`, `KpiGridBlock`, `FleetTelematicsBlock`, etc. in `apps/workspaces/src/lib/projectPage/blocks.ts`
- Pattern: Discriminated union on `kind` property; new blocks added by extending union, adding renderer, registering in `PAGE_BLOCK_REGISTRY`
- Registry: `PAGE_BLOCK_REGISTRY` — array of `PageBlockDef` metadata (title, description, factory, icon); used to build the slash menu palette
- Purpose: Generic, plugin-extensible pipeline for data processing (input → process → output)
- Location: `apps/workspaces/src/lib/miniProgram/blocks.ts`
- Pattern: Ordered array of blocks; each block has `kind`, optional `source` (points to prior block's output), and kind-specific config
- Runtime: Sequential evaluation; block output (dataset) flows into next block's input (unless `source` overrides)
- Plugins: Registry (`lib/miniProgram/plugins/registry.ts`) maps plugin ID → manifest → UI + evaluator
- Purpose: Encapsulate projects (containers), programs (mini program definitions), and pages (dashboard configs)
- Location: `apps/api/src/domains/projects/`
- Pattern: Service layer calls repository; repository writes/reads PostgreSQL; service applies business rules (ownership checks, event recording)
- Types: `Project`, `Program`, `ProjectPage` in `projects.types.ts`; DTOs for input validation in `dto/`
- Purpose: Dynamically show/hide sidebar nav items based on `workspace.enabled_modules`
- Location: `apps/workspaces/src/components/layout/WorkspaceSidebar.tsx`
- Pattern: `ITEMS` array maps module key (e.g., 'fleet', 'programs') to nav item; filter at render time based on `enabled` set
- Used by: Licensing/tenant config — different workspace types enable different modules
## Entry Points
- Location: `apps/workspaces/src/app/layout.tsx`
- Triggers: User navigates to `https://workspaces.vectra.local/`
- Responsibilities: 
- Location: `apps/api/src/server.ts`
- Triggers: `npm run dev` or deployed container starts
- Responsibilities:
- Location: `apps/cmr/src/app/layout.tsx`, `apps/marketplace/src/app/layout.tsx`
- Triggers: User clicks cross-app link from Workspaces sidebar
- Responsibilities: Isolated Next.js apps; each has its own page routes and components, but reuse auth context and API client from workspaces
## Error Handling
- **AppError class** (`apps/api/src/core/errors/AppError.ts`): Extends Error with `status` (HTTP code) and `message`
- **Async handler wrapper** (`core/errors/asyncHandler.ts`): Wraps route handlers, catches async errors, passes to global handler
- **Global error handler** (`core/errors/errorHandler.ts`): Express middleware; serializes AppError to JSON response + logs
- **Validation with Zod**: Services call `schema.safeParse(body)` → throw AppError(400, issue message) on fail
- **Ownership checks**: Service methods call `assertOwnedProject(id, companyId)` → throw 403 if mismatch
## Cross-Cutting Concerns
- Approach: `console.log` for startup/health checks; structured logging not yet implemented
- Activity log: `recordEvent()` in `core/events/activityLog.ts` — audit trail in `activity_events` table, keyed by `tenantId`
- Approach: Zod schemas in domain `dto/` folders; service layer parses before repo calls
- Example: `projects/dto/project.dto.ts` defines `CreateProjectSchema`, `UpdateProjectSchema`
- Approach: JWT in Authorization header (Bearer token); SSO cookie for session persistence
- Middleware: `authenticateToken()` in `core/auth/middleware.ts` extracts + verifies token; sets `req.user` + `req.companyId`
- All domain routes protected with `router.use(authenticateToken)`
- Approach: WebSocket rooms keyed on `projectId` or `companyId`; service calls `bus.emitToRoom(room, event)` to broadcast
- Implementation: Socket.io with per-user namespacing; connection auth via JWT
- Used by: Page edits, activity feed, live chat
- Approach: Row-level security via `companyId` (workspace); all queries scoped to tenant
- JWT payload: includes `companyId`; every API request validates ownership before returning data
- Database: No schema-level multi-tenancy; isolation via WHERE clauses + middleware validation
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
