# Technology Stack

**Analysis Date:** 2026-07-04

## Languages

**Primary:**
- TypeScript 5.3.2 - All backend API and frontend app code (`apps/api/src`, `apps/*/src`)
- JavaScript (TSX/JSX) - React components and Next.js pages (`apps/*/src`)

**Secondary:**
- Python 3.11 - LTL matching engine microservice (`services/matching-engine/`)
- SQL - PostgreSQL migrations and database schemas (`database/migrations/`)
- Bash/Shell - Docker entrypoints and build scripts

## Runtime

**Environment:**
- Node.js (version unspecified, inferred 18+ from package.json targets)
- Python 3.11 - For matching-engine microservice

**Package Manager:**
- npm (workspace monorepo)
- Lockfiles: `package-lock.json` present in root and per-app; pinned Python dependencies in `requirements.txt`

## Frameworks

**Core Backend:**
- Express.js 4.18.2 - REST API server (`apps/api/src/server.ts`)
- Socket.io 4.7.2 - Real-time websocket communication for realtime features
- TypeScript 5.3 - Backend type safety

**Frontend:**
- Next.js 14.0.3 - Three frontend apps (Marketplace, Workspaces, CMR)
  - Location: `apps/marketplace`, `apps/workspaces`, `apps/cmr`
  - Output mode: standalone (for Docker)
  - Shared workspace packages transpiled at build time
- React 18 - UI component library
- TailwindCSS 3.3.0 - Styling (all frontend apps)

**Microservices:**
- FastAPI 0.104.1 - Python async HTTP framework for matching engine (`services/matching-engine/main.py`)
- Uvicorn 0.24.0 - ASGI web server for matching engine

**State Management & Queries:**
- TanStack React Query 5.99.2 - Server state management and caching (all frontend apps)

**Validation & Serialization:**
- Zod 4.3.6 - TypeScript-first schema validation (`apps/api/src/domains/*/dto/`)
- Pydantic 2.5.2 - Python data validation in matching engine

## Key Dependencies

**Critical:**
- `pg` 8.11.3 - PostgreSQL client for Node.js
- `redis` 4.6.10 - Redis client for caching and pub/sub
- `express` 4.18.2 - HTTP server framework
- `jsonwebtoken` 9.0.3 - JWT token signing/verification for auth

**Infrastructure & Communication:**
- `socket.io` 4.7.2 - Real-time bidirectional communication
- `socket.io-client` 4.7.2 - Client-side socket connection (all frontend apps)
- `axios` 1.6.2 - HTTP client for internal service calls
- `bullmq` 5.76.0 - Redis-based task queue for async jobs (matching engine worker)
- `redis` 5.0.1 (Python) - Redis client for matching engine

**AI & Content Processing:**
- `@google/generative-ai` 0.24.1 - Google Gemini API client for AI completions
- `pdfkit` 0.14.0 - PDF generation for documents
- `html2canvas` 1.4.1 - HTML-to-canvas rendering (Workspaces, CMR)
- `jspdf` 4.2.0 - PDF export (Workspaces, CMR)
- `dompurify` 3.3.3 - XSS sanitization (Workspaces, CMR)

**Data Visualization & Maps:**
- `recharts` 3.9.1 - React chart library (Workspaces only)
- `leaflet` 1.9.4 - Map rendering library (Marketplace, Workspaces)
- `react-leaflet` 4.2.1 - React wrapper for Leaflet (Marketplace, Workspaces)

**UI & Interaction:**
- `lucide-react` 0.294.0 - Icon library (all frontend apps)
- `@dnd-kit/*` (core 6.3.1, sortable 10.0.0, modifiers 9.0.0) - Drag-and-drop (Workspaces)
- `next-themes` 0.4.6 - Dark mode theme provider (all frontend apps)

**File & Data Export:**
- `xlsx` 0.18.5 - Excel spreadsheet generation (Workspaces, CMR)
- `jszip` 3.10.1 - ZIP file creation (Workspaces)
- `canvg` 4.0.3 - Canvas/SVG rendering (Workspaces)

**Utilities:**
- `multer` 2.1.1 - File upload middleware
- `bcrypt` 6.0.0 - Password hashing
- `uuid` 9.0.1 - UUID generation
- `cors` 2.8.5 - CORS middleware
- `dotenv` 16.3.1 - Environment variable loading

**Client-side Storage:**
- `idb-keyval` 6.2.2 - IndexedDB key-value store wrapper (Workspaces)

**Monorepo & Workspace Packages:**
- `@vectra/api-client` - HTTP client wrapper for API calls (shared package)
- `@vectra/auth` - Authentication logic and hooks (shared package)
- `@vectra/data` - Realtime socket, notifications, document components (shared package)
- `@vectra/types` - TypeScript type definitions (shared package)
- `@vectra/ui` - Reusable React components (shared package)
- `@vectra/config` - Configuration exports (shared package)

## Configuration

**Environment:**
- `.env.example` - Example configuration template (present)
- Environment variables loaded via `dotenv` package
- Configuration per service: API, Redis, PostgreSQL, JWT, cross-app URLs, AI providers, Microsoft OAuth

**Build:**
- `tsconfig.json` - TypeScript compiler config (`apps/api/tsconfig.json`)
  - Target: ES2022, Module: CommonJS
  - Strict mode enabled
  - Excludes: node_modules, test files
- `next.config.mjs` - Next.js config (`apps/workspaces/next.config.mjs`, similar in other apps)
  - Output: standalone
  - Transpile workspace packages at build time
  - Trace from monorepo root for Docker bundling
- `tailwind.config.ts` - Tailwind CSS config (all frontend apps)
- `postcss.config.js` - PostCSS config (all frontend apps)
- ESLint config (`.eslintrc.json` in frontend apps, minimal)

**Docker:**
- `Dockerfile` (API backend) - Node.js production build
- `Dockerfile` (Frontend apps) - Multi-stage Next.js production builds
- `Dockerfile.web.dev` - Development image for all frontend apps
- `Dockerfile` (matching-engine) - Python slim base with uvicorn
- `docker-compose.yml` - Full stack orchestration with 6 services

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from package.json)
- npm workspace support
- Docker & Docker Compose (for local database/redis/services)
- PostgreSQL 15 (in container)
- Redis 7 (in container)
- Python 3.11 (for matching-engine development)

**Production:**
- Docker container orchestration (Kubernetes, Docker Swarm, or cloud platform)
- PostgreSQL 15+ managed database
- Redis 7+ managed cache/queue
- Node.js 18+ runtime
- Python 3.11 runtime (for matching-engine)
- SSL/TLS certificate for HTTPS
- DNS configured for three frontend subdomains (marketplace, workspaces, cmr) or single domain with path-based routing

**Deployment:**
- Containerized: All services ship as Docker images
- Monorepo deployment: Single docker build context with multi-stage Dockerfiles
- Cross-app SSO: Shared cookie domain (configurable via `NEXT_PUBLIC_COOKIE_DOMAIN`)

---

*Stack analysis: 2026-07-04*
