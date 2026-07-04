# External Integrations

**Analysis Date:** 2026-07-04

## APIs & External Services

**AI Providers (Cloud):**
- Google Gemini (`@google/generative-ai` 0.24.1)
  - What it's used for: Text completion, content generation, analysis
  - Implementation: `apps/api/src/domains/ai/ai.service.ts`
  - Provider config storage: PostgreSQL `ai_config` table
  - API key encryption: AES-256 encryption at rest
  - Model: Configurable (default: `gemini-1.5-pro`)
  - Supported providers: OpenAI, Gemini, local endpoints

- OpenAI (`axios` for HTTP calls)
  - Model: Configurable (default: `gpt-4o`)
  - Implementation: Unified interface via `ai.service.ts`
  - API key encrypted and stored per company

- Local AI Models
  - Endpoint: Company-configured local inference server
  - Use case: Self-hosted or on-premise AI completion
  - Implementation: Browser-side or via custom local endpoint

**Calendar & Outlook Integration (Microsoft 365):**
- Microsoft Graph API (OAuth 2.0)
  - What it's used for: Email reading, calendar sync, event management
  - Implementation: `apps/api/src/domains/outlook/outlook.service.ts`
  - SDK: Native HTTP via `axios` + JWT for OAuth state
  - Authentication: OAuth 2.0 auth code flow with PKCE
  - Scopes: `Mail.Read`, `Mail.Send`, `Calendars.Read`
  - Env vars (optional):
    - `MS_CLIENT_ID` - Entra application ID
    - `MS_CLIENT_SECRET` - Entra application secret
    - `MS_REDIRECT_URI` - OAuth callback URL (e.g., `http://localhost:8080/api/v1/outlook/callback`)
    - `MS_TENANT` - Entra tenant (`common` for multi-tenant)
  - Demo mode: When credentials are unset, Outlook connector runs in demo mode (simulated connections)
  - Production: Set all env vars to enable real OAuth flow (no code changes required)

**Matching Engine (LTL Logistics):**
- Internal microservice (Python FastAPI)
  - What it's used for: LTL (Less-Than-Truckload) shipment matching and optimization
  - URL: `MATCHING_ENGINE_URL` (default: `http://matching-engine:8000`)
  - Communication: REST/HTTP via `axios`
  - Database: Shared Redis (`REDIS_URL`) for inter-service communication
  - Service location: `services/matching-engine/`

## Data Storage

**Databases:**

**PostgreSQL 15:**
- Connection string: `DATABASE_URL` (e.g., `postgres://user:password@postgres:5432/vectra_db`)
- Client: `pg` (node-postgres 8.11.3)
- Driver type: Native async
- Schemas and tables: 20+ migrations in `database/migrations/`
- Key tables (via migrations):
  - Core: users, companies, workspaces, presets
  - Features: projects, programs, mini_programs, folders, team_assignments
  - Content: project_pages, page_hierarchy, page_header
  - Calendar: calendar_events (Outlook sync)
  - Communications: email_campaigns
  - Fleet: fleet_drivers, fleet_vehicles
  - Yard: yard_management
  - Inbox: smart_inbox
  - Billing: billing_records, invoicing
  - Matching: ltl_matching
- Realtime triggers: PostgreSQL NOTIFY/LISTEN for websocket notifications
- Data location: Docker volume `postgres_data` (development); managed database (production)

**Redis 7:**
- Connection string: `REDIS_URL` (default: `redis://redis:6379`)
- Client: `redis` (4.6.10)
- Use cases:
  - Cache layer for API responses
  - Session/auth token storage
  - Pub/sub for real-time socket.io messaging
  - Job queue (BullMQ) for async tasks
  - Matching engine state coordination
- Data location: Docker volume `redis_data` (development)

**File Storage:**
- Local filesystem (development): `apps/api/uploads/`
- Served via Express static middleware: `/uploads` endpoint
- Production: Should be migrated to cloud storage (S3, GCS, Azure Blob) for scalability
- Current limitations: Single-instance deployment; needs object storage for multi-instance

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `apps/api/src/routes/authRoutes`, `packages/auth/`
  - Token format: JWT signed with `JWT_SECRET`
  - Token expiration: Configurable (typically short-lived)
  - Refresh mechanism: Via token refresh endpoint
  - Env var: `JWT_SECRET` (must be 32+ chars in production)

**OAuth 2.0 (Microsoft 365):**
- Outlook/Calendar connector: OAuth callback at `POST /api/v1/outlook/callback`
- State validation: JWT-based state parameter (10-minute expiration)
- Token storage: Encrypted in PostgreSQL `outlook_connections` table
- Token refresh: Automatic via refresh token flow

**Multi-tenancy:**
- Workspace/Company-level isolation: All operations scoped to `companyId`
- SSO cookie domain: `NEXT_PUBLIC_COOKIE_DOMAIN` (shared across three app subdomains in production)
- User roles: team_assignments table with per-workspace role assignment

## Monitoring & Observability

**Error Tracking:**
- Not detected - App logs to console/stdout in containers
- Recommendation: Integrate Sentry, DataDog, or New Relic for production

**Logs:**
- Console logging via `console.log`, `console.error`
- Activity audit log: `recordEvent()` function in `apps/api/src/core/events/activityLog`
  - Tracks: user actions, integrations connected, data changes
  - Storage: PostgreSQL `activity_log` table
- Docker: Logs to stdout (captured by container orchestration)

**Health Checks:**
- API health endpoint: `GET /health` (returns `{ status: "OK", message: "VECTRA backend running" }`)
- Docker Compose health checks:
  - PostgreSQL: `pg_isready` check (5s interval)
  - Redis: `redis-cli ping` check (5s interval)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (development/testing)
- Production: Kubernetes, Docker Swarm, or cloud platform (AWS ECS, Azure Container Instances, etc.)
- Container registry: Assumed Docker Hub or private registry (configuration TBD)

**Build & Deployment:**
- No CI/CD pipeline detected in codebase
- Recommendation: GitHub Actions, GitLab CI, Jenkins, or cloud-native CI/CD
- Build artifacts: Docker images for each service
  - API: `apps/api/Dockerfile`
  - Marketplace: Frontend image (shared `Dockerfile.web.dev`)
  - Workspaces: Frontend image (shared `Dockerfile.web.dev`)
  - CMR: Frontend image (shared `Dockerfile.web.dev`)
  - Matching Engine: `services/matching-engine/Dockerfile`

**Environment Configuration:**
- `.env` file (development): Variables loaded at runtime
- Docker env vars: Specified in `docker-compose.yml` per service
- Production: Environment variables via:
  - Kubernetes secrets/configmaps
  - Cloud platform secret management (AWS Secrets Manager, Azure Key Vault, etc.)
  - `.env` file (less secure, not recommended)

## Webhooks & Callbacks

**Incoming:**
- Outlook OAuth callback: `POST /api/v1/outlook/callback?code=...&state=...`
  - Implementation: `apps/api/src/domains/outlook/outlook.controller.ts`
  - Triggers: Token exchange, credentials storage, session update
  - Redirect: Returns to `WORKSPACES_APP_URL` (default: `http://localhost:3001`)

- Webhook routes (legacy): `POST /api/webhooks/*` (framework exists; specific integrations unclear)
  - Implementation: `apps/api/src/routes/webhookRoutes`

**Outgoing:**
- Socket.io events: Real-time push to connected clients
  - Implementation: `apps/api/src/core/realtime/socket`
  - Events: Document changes, calendar updates, activity notifications
  - No external HTTP webhooks detected

## Environment Configuration

**Required env vars (critical for functionality):**
- `NODE_ENV` - development/production
- `PORT` - API server port
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing key (32+ chars minimum)
- `ENCRYPTION_KEY` - AES key for encrypting sensitive data (64-char hex string)

**Outlook Integration (optional):**
- `MS_CLIENT_ID` - Leave unset for demo mode
- `MS_CLIENT_SECRET` - Leave unset for demo mode
- `MS_REDIRECT_URI` - OAuth callback URL
- `MS_TENANT` - Entra tenant ID (default: `common`)
- `WORKSPACES_APP_URL` - Where OAuth callback redirects (default: `http://localhost:3001`)

**AI Configuration (optional):**
- Set per-company via API, not environment variables
- Storage: PostgreSQL `ai_config` table
- API keys encrypted at rest

**Microservices:**
- `MATCHING_ENGINE_URL` - LTL matching service endpoint
- `BACKEND_API_URL` - API server URL (for internal service calls)

**Frontend Apps:**
- `NEXT_PUBLIC_API_URL` - API endpoint (browser-accessible)
- `NEXT_PUBLIC_MARKETPLACE_URL` - Marketplace app URL
- `NEXT_PUBLIC_WORKSPACES_URL` - Workspaces app URL
- `NEXT_PUBLIC_CMR_URL` - CMR app URL
- `NEXT_PUBLIC_COOKIE_DOMAIN` - SSO cookie domain (leave unset in dev for host-only; set to `.vectra.app` in production)

**Secrets location:**
- Development: `.env` file (git-ignored, use `.env.example` as template)
- Production: Kubernetes secrets, cloud secret manager, or CI/CD environment variables
- Never commit actual secrets; use `.env.example` as documentation

## Real-time Communication

**WebSocket (Socket.io):**
- Server: `apps/api/src/core/realtime/socket`
- Client library: `socket.io-client` 4.7.2 (all frontend apps)
- Features:
  - Document synchronization (page canvas, blocks, etc.)
  - Calendar event notifications
  - Inbox message updates
  - Real-time collaboration signals
- CORS: All origins allowed (`origin: "*"` in dev; restrict in production)
- Authentication: JWT token passed in connection handshake

---

*Integration audit: 2026-07-04*
