# Testing Patterns

**Analysis Date:** 2026-07-04

## Current State

**Test Coverage:** Minimal to absent

- No test files found in `apps/api/src/`, `apps/workspaces/src/`, `apps/cmr/src/`, or `apps/marketplace/src/`
- No Jest, Vitest, or other test runner configuration detected in application directories
- All test files found are from `node_modules/` (transitive dependencies)
- tsconfig excludes test files: `"exclude": ["node_modules", "**/*.test.ts"]`
- No test scripts in any `package.json` (no `npm test`, `jest`, `vitest` commands)

## Test Framework

**Runner:**
- None configured; project has no test framework installed at workspace level
- Test dependencies would typically include: `jest` or `vitest` + `@types/jest`
- No `jest.config.js`, `vitest.config.ts`, or similar files present

**Assertion Library:**
- Not in use; no test framework means no assertion library

**Recommended Setup (if implementing tests):**
```bash
# Would typically be:
npm install --save-dev vitest @vitest/ui
# or
npm install --save-dev jest @types/jest ts-jest
```

**Run Commands (if implemented):**
```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Test File Organization (Recommended Pattern)

**Location:**
- Co-located with source: `[module].test.ts` or `[module].spec.ts` in same directory
- Alternative: parallel `__tests__/` directory per module (not observed in codebase)

**Naming:**
- API domain: `[domain].service.test.ts` (for service logic)
- API domain: `[domain].repository.test.ts` (for database queries)
- React component: `[Component].test.tsx` (for component rendering/interaction)
- React hooks: `use[Hook].test.ts` (for hook logic)

**Structure (recommended):**
```
apps/api/src/domains/ai/
├── ai.service.ts
├── ai.service.test.ts       # ← Test file
├── ai.repository.ts
├── ai.repository.test.ts    # ← Test file
├── ai.controller.ts
├── ai.routes.ts
├── ai.types.ts
└── dto/
    └── save-ai-config.dto.ts
```

## Testing Patterns (Recommended Approach)

**Test Structure:**
Based on codebase architecture, recommended pattern follows Domain-Driven Design layers:

```typescript
// Example: ai.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiService } from './ai.service';
import { aiRepository } from './ai.repository';

vi.mock('./ai.repository');

describe('AiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('returns public config for company', async () => {
      const mockRow = {
        company_id: 'c1',
        provider: 'openai',
        model: 'gpt-4o',
        api_key_enc: 'encrypted',
        local_endpoint: null,
        local_model: null,
        updated_at: new Date().toISOString(),
      };
      vi.mocked(aiRepository.findByCompany).mockResolvedValue(mockRow);

      const result = await aiService.getConfig('c1');

      expect(result).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
        hasApiKey: true,
        localEndpoint: null,
        localModel: null,
        updatedAt: mockRow.updated_at,
      });
    });
  });
});
```

**Setup Pattern:**
- `beforeEach` for test isolation (clear mocks, reset state)
- `vi.clearAllMocks()` (Vitest) or `jest.clearAllMocks()` (Jest)
- Test databases: use transaction rollback or in-memory SQLite for isolation

**Teardown Pattern:**
- Database connections closed in `afterAll` hook
- Redis connections cleaned up in `afterAll` hook
- Timers cleared if using `vi.useFakeTimers()`

**Assertion Pattern:**
- Direct `expect()` statements from test framework
- Fluent assertions: `expect(result).toEqual(expected)`
- Snapshot testing for complex objects: `expect(result).toMatchSnapshot()`

## Mocking

**Framework:**
- Would typically use Vitest's `vi` or Jest's `jest` for mocking
- Native TypeScript module mocking via `vi.mock('./path')` or `jest.mock('./path')`

**Patterns (recommended):**

```typescript
// Mock a module
vi.mock('./ai.repository');

// Mock a function
vi.spyOn(aiRepository, 'findByCompany').mockResolvedValue(mockRow);

// Mock external HTTP calls
vi.mock('axios');
const mockAxios = vi.mocked(axios);
mockAxios.post.mockResolvedValue({ data: { choices: [{ message: { content: 'response' } }] } });

// Restore mocks
vi.restoreAllMocks();
```

**What to Mock:**
- External APIs (OpenAI, Gemini, Samsara, Geotab) — never call real APIs in tests
- Database queries — mock repository methods, test with isolated data
- Redis operations — mock in-memory cache
- Socket.io events — mock in-memory for integration tests
- File system operations (if any) — use `memfs` or mock `fs` module

**What NOT to Mock:**
- Zod schema validation — test actual validators to catch regression
- Error handling — test real `AppError` throws to verify error contracts
- Domain logic in services — test with real (mocked) dependencies, not partial mocks
- Middleware (auth, error handling) — integration tests to verify pipeline

## Fixtures and Factories

**Test Data (recommended pattern):**

```typescript
// ai.service.test.ts — inline factory
function createAiConfigRow(overrides?: Partial<AiConfigRow>): AiConfigRow {
  return {
    company_id: 'c-test-1',
    provider: 'openai',
    model: 'gpt-4o',
    api_key_enc: null,
    local_endpoint: null,
    local_model: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Or centralized fixtures directory
// tests/fixtures/ai.fixtures.ts
export const MOCK_AI_CONFIG_ROW = { ... };
export const MOCK_COMPANY_ID = 'c-test-1';
```

**Location (recommended):**
- Inline factories in test files for simple cases
- Centralized `tests/fixtures/[domain].fixtures.ts` for complex shared data
- No observed pattern in current codebase; convention above is recommended

## Coverage

**Requirements:** None enforced

- No coverage threshold in CI/CD or pre-commit hooks
- No coverage config found

**Recommended target (by area):**
- Services: 80%+ (business logic is critical)
- Repositories: 70%+ (data access patterns matter)
- Controllers: 40%+ (thin layer, less critical)
- Utilities: 90%+ (reusable code must be correct)
- Components: 50%+ (visual regression harder to test; Storybook preferred)

**View Coverage (if implemented):**
```bash
npm run test:coverage
# Generates coverage/ directory with HTML report
```

## Test Types

**Unit Tests:**
- Scope: Individual service methods, repository queries, validation schemas
- Approach: Mock all dependencies (repository, external APIs, utilities)
- Example: Test `aiService.complete()` with mocked repository and axios
- Location: `[module].service.test.ts`, `[module].repository.test.ts`

**Integration Tests:**
- Scope: Multi-layer workflow (controller → service → repository → database)
- Approach: Mock external APIs only; use test database with transactions
- Example: Test `/api/v1/ai/complete` endpoint with real service + database
- Location: `[module].integration.test.ts` (separate from unit)
- Setup: Test database fixture, transaction rollback after each test

**E2E Tests:**
- Status: Not implemented
- Recommended framework: Playwright or Cypress for frontend
- Would test: full user workflows through UI (login → create project → run program)
- Scope: Browser automation, real backend, test environment
- Not critical for backend API but valuable for user-facing features

## Common Patterns

**Async Testing:**
```typescript
// Vitest
it('fetches config async', async () => {
  const result = await aiService.getConfig('c1');
  expect(result).toBeDefined();
});

// With polling/timeout
it('waits for async operation', async () => {
  const promise = aiService.complete(/* ... */);
  await expect(promise).resolves.toBeTruthy();
});
```

**Error Testing:**
```typescript
// Test error throws
it('throws on missing company', async () => {
  await expect(aiService.getConfig(null as any))
    .rejects
    .toThrow(/company/i);
});

// Test error type
it('throws AppError with 400 status', async () => {
  try {
    await aiService.saveConfig('c1', {}, null);
    expect.fail('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(400);
  }
});

// Test validation errors
it('rejects invalid DTO', async () => {
  const invalid = { provider: 'invalid' };
  await expect(aiService.saveConfig('c1', invalid, null))
    .rejects
    .toThrow();
});
```

**Database Testing (recommended):**
```typescript
// Use transactions for isolation
it('saves and retrieves config', async () => {
  const conn = await db.connect();
  try {
    await conn.query('BEGIN TRANSACTION');
    
    const row = await aiRepository.upsert(/* ... */);
    expect(row.id).toBeDefined();
    
    await conn.query('ROLLBACK TRANSACTION');
  } finally {
    conn.release();
  }
});
```

## Recommended Testing Setup (Not Yet Implemented)

To implement testing, recommended approach:

1. **Install Vitest** (preferred for TS projects):
   ```bash
   npm install --save-dev vitest @vitest/ui
   ```

2. **Create config** (`vitest.config.ts`):
   ```typescript
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       coverage: { provider: 'v8', reporter: ['text', 'html'] },
     },
   });
   ```

3. **Add scripts** to `package.json`:
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:watch": "vitest --watch",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

4. **Start with API domain tests** (service + repository layer)
5. **Add React component tests** with `@testing-library/react`

---

*Testing analysis: 2026-07-04*
