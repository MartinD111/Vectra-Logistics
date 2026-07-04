# Coding Conventions

**Analysis Date:** 2026-07-04

## Naming Patterns

**Files:**
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

**Functions:**
- camelCase (e.g., `getAiConfig`, `saveConfig`, `completeOpenAi`)
- Handler functions: descriptive names starting with verb (e.g., `getAiConfig`, `saveAiConfig`, `completeAi`, `translateAi`)
- Async functions: standard `async` keyword, never callback-based
- Private methods: prefix with underscore `_methodName` or use JavaScript `#` private fields
- Service class methods: camelCase, public (e.g., `getConfig`, `saveConfig`, `hasCloudProvider`, `complete`)

**Variables:**
- camelCase for local scope (e.g., `companyId`, `apiKey`, `localEndpoint`)
- snake_case for database columns and row objects (e.g., `api_key_enc`, `company_id`, `updated_at`)
- UPPERCASE for constants (e.g., `DEFAULT_MODEL`, `NO_SIDEBAR`)
- Query keys (React Query): object notation with const suffix `qk` (e.g., `qk.projects`, `qk.activity(id)`)

**Types:**
- Interfaces for public API contracts and row objects (e.g., `AiConfigPublic`, `AiConfigRow`, `Project`)
- Types for DTO objects inferred from Zod schemas (e.g., `SaveAiConfigDto = z.infer<typeof SaveAiConfigSchema>`)
- Union types for enumerations (e.g., `AiProvider = 'openai' | 'gemini' | 'local'`)
- `Dto` suffix for request/response schema types (e.g., `CreateDriverDto`, `UpdateVehicleDto`)

## Code Style

**Formatting:**
- No Prettier config enforced; code follows implicit convention
- Line length: ~100–120 characters typical (see `ai.service.ts` for reference)
- Trailing commas in multi-line arrays/objects
- Single quotes for strings in JS/TS, double quotes in HTML/JSX attributes

**Linting:**
- ESLint config: `extends: "next/core-web-vitals"` in `apps/workspaces/.eslintrc.json`
- API app: TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- No other linting config detected in API app; relies on TypeScript strictness

**TypeScript:**
- Target: `es2022`
- `strict: true` enforced in API
- Type annotations explicit on function parameters and return types
- No `any` type usage observed; types are fully specified

## Import Organization

**Order:**
1. Node.js built-in modules (`express`, `http`, `dotenv`)
2. Third-party packages (`pg`, `zod`, `axios`, `@google/generative-ai`)
3. Local relative imports from `core/` (`../../core/errors`, `../../core/db`)
4. Local relative imports from domain (`./?` pattern for same domain)
5. Absolute path aliases (`@/lib/`, `@/context/`, `@vectra/` scoped packages)

**Path Aliases:**
- Frontend (`apps/workspaces`): `@/` points to `src/` (Next.js standard)
- Shared packages: `@vectra/api-client`, `@vectra/auth`, `@vectra/data`, `@vectra/types`, `@vectra/ui`
- No path aliases in API app (`apps/api`); relative imports used exclusively

## Error Handling

**Patterns:**
- Custom `AppError` class extending `Error` with `status: number` property (see `apps/api/src/core/errors/AppError.ts`)
- Throw `AppError` with HTTP status and user-facing message: `throw new AppError(400, 'message')`
- Status codes: 400 for validation, 403 for authorization, 404 for not found, 502 for external service failures
- `asyncHandler` wrapper for Express handlers (see `apps/api/src/core/errors/asyncHandler.ts`) — catches promise rejections and passes to `errorHandler`
- Global error handler (see `apps/api/src/core/errors/errorHandler.ts`): logs unhandled errors, returns JSON error response
- Validation errors: use Zod `.safeParse()`, extract error message from first issue: `parsed.error.issues[0].message`
- External API errors: normalize provider errors into `AppError` without leaking secrets (see `ai.service.ts` `providerError` method)

**Example:**
```typescript
const parsed = SaveAiConfigSchema.safeParse(body);
if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
```

## Logging

**Framework:** `console.log` / `console.error` (no structured logger library)

**Patterns:**
- Prefix error logs with context: `console.error('Auth error:', err)` or `console.error('[Unhandled]', err)`
- Info logs for service startup: `console.log('PostgreSQL connected')`
- No production-level log levels (debug, warn, info) enforced; console methods used directly
- Errors from external services must be sanitized before logging (API keys must never appear in logs)

## Comments

**When to Comment:**
- Explain business logic complexity (e.g., "Cloud key: encrypt when provided, keep existing when omitted..." in `ai.service.ts`)
- Explain non-obvious design decisions (e.g., "Local providers are called directly from the browser, not via the server proxy")
- Database migration comments: describe table purpose, column constraints, and migration sequencing
- TODO comments for incomplete features (see `apps/api/src/domains/integrations/integrations.service.ts` for `TODO: Replace stub with real...`)
- No over-commenting; prefer self-documenting code with clear function/variable names

**JSDoc/TSDoc:**
- Minimal JSDoc usage observed; when present, document public methods with inline block comments
- Example: `/** Upsert config. ... */` in repository methods
- Type annotations serve as documentation; JSDoc not heavily relied upon

## Function Design

**Size:** 
- Typical range: 20–50 lines for service methods
- Larger methods (100+ lines) are feature-focused (e.g., `automation.service.ts` 352 lines for invoice parsing workflow)
- Controller handlers: 1–3 lines (delegate to service immediately)

**Parameters:**
- Request/response pairs in Express handlers: `(req: AuthRequest, res: Response, next?: NextFunction)`
- Service methods take domain objects and primitives: `async getConfig(companyId: string)`
- DTO objects passed via `req.body` after validation: `saveConfig(companyId: string, body: unknown, userId: string | null)`
- Optional trailing parameters use `?` or overloads (e.g., `useProjectActivity(id: string, limit = 20)`)

**Return Values:**
- Async methods return typed objects: `Promise<AiConfigPublic>`
- Controllers return `void` (status set via `res.status().json()`)
- Services return domain objects or primitive results
- Nullable results: return `| null` (e.g., `Promise<AiConfigRow | null>`)

## Module Design

**Exports:**
- Singleton instances of services/repositories exported: `export const aiService = new AiService()` (not classes, instances)
- Controller functions exported as named exports: `export const getAiConfig = asyncHandler(...)`
- Routes file exports default Router: `export default router`
- API module files export interfaces + fetch functions: `export interface Project { ... }` then `export async function list()`
- React hooks exported as named exports: `export function useProjectActivity(...)`

**Barrel Files:**
- Root domain barrel: `apps/api/src/domains/index.ts` exports all domain routers
- No component barrel files observed; components imported directly by path
- API module files are not barrels; each domain has its own `[domain].api.ts` file

## SQL Conventions

**Migrations:**
- Idempotency: `CREATE TABLE IF NOT EXISTS` and `CREATE EXTENSION IF NOT EXISTS`
- Naming: sequential numbered `NNN_description.sql` (001, 002, 003, etc.)
- Header comments: purpose, sequencing, and idempotency guarantee
- Column naming: snake_case (e.g., `company_id`, `api_key_enc`, `updated_at`)
- Timestamps: `TIMESTAMPTZ` with `DEFAULT NOW()` for audit trails
- Foreign keys: explicit `REFERENCES table(column) ON DELETE CASCADE/SET NULL`
- Encrypted fields suffix: `_enc` (e.g., `api_key_enc` for AES-256-GCM envelope)
- Boolean/status columns: `TEXT` type with enum values (e.g., `'open'`, `'matched'`, `'dismissed'`)
- Indexes: explicit `CREATE INDEX IF NOT EXISTS` for query optimization

**Example:**
```sql
-- Migration: Company AI configuration. Apply after 004. Idempotent.
CREATE TABLE IF NOT EXISTS company_ai_config (
  company_id       UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'openai',   -- openai | gemini | local
  api_key_enc      TEXT,                             -- encrypted envelope (cloud only); NULL for local
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Domain Organization

**API (Express) Pattern:**
Each domain under `apps/api/src/domains/[domain]/` follows this structure:
- `[domain].controller.ts` — HTTP request handlers, parameter extraction, status codes
- `[domain].service.ts` — business logic, external API calls, orchestration
- `[domain].repository.ts` — database queries, ORM, data access
- `[domain].types.ts` — domain-specific interfaces and types
- `[domain].routes.ts` — Express Router, middleware, endpoint definitions
- `dto/` subdirectory — Zod schemas and DTO types for request validation

**Layer responsibilities:**
- Controller: extract/validate input, call service, return response
- Service: orchestrate business logic, manage transactions, call external APIs
- Repository: database queries only, return raw database rows
- Routes: define endpoints and middleware order (auth, role checks)

**Example from `ai` domain:**
- Controller (`ai.controller.ts`) handles `/config` GET/POST via `requireCompany` middleware
- Service (`ai.service.ts`) encrypts API keys, calls OpenAI/Gemini, manages provider selection
- Repository (`ai.repository.ts`) manages `company_ai_config` table with upsert logic
- DTO (`dto/save-ai-config.dto.ts`) defines `SaveAiConfigSchema` Zod validator
- Routes (`ai.routes.ts`) registers endpoints with auth + role middleware

## React/Next.js Patterns

**Component Structure:**
- All components marked `'use client'` at top (client-side rendering)
- Functional components with hooks
- Type definitions inline or in interfaces at file top
- Props typed with `{ prop: Type }` parameter syntax
- Child elements typed as `ReactNode` or `PropsWithChildren`

**State Management:**
- React Query (`@tanstack/react-query`) for server state: `useQuery`, `useMutation`
- Context API for app state: `useAuth()`, `usePlatform()`
- Local state via `useState` for form fields and UI state
- No Redux or Zustand observed

**Query Keys (React Query):**
- Centralized query key factory with `as const` for type safety
- Example: `const qk = { projects: ['projects'] as const, project: (id: string) => ['projects', id] as const }`
- Nested structure mirrors domain hierarchy

**Hook Patterns:**
- Custom hooks in `apps/workspaces/src/lib/hooks/use[Domain].ts`
- Hooks wrap React Query operations and API calls
- Hooks check `enabled: !!user?.company_id && !!id` for conditional execution
- Return `useQuery` result directly (includes `data`, `isLoading`, `error`)

**API Integration:**
- API functions in `apps/workspaces/src/lib/api/[domain].api.ts`
- Interfaces for API response shapes co-located with fetch functions
- No type duplication; interfaces defined once per domain
- Fetch via `apiFetch` client from `@vectra/api-client` shared package

---

*Convention analysis: 2026-07-04*
