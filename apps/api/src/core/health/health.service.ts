// ── Live dependency health check ──────────────────────────────────────────
//
// Pure, DI-friendly Postgres/Redis reachability probe used by the `/health`
// endpoint (HRD-03, D-01/D-02/D-03). Unlike `secrets.ts`, which reads
// `process.env` directly at boot time, this module never touches
// `process.env` and never imports the `db`/`redisClient` singletons — both
// probes are injected via `HealthCheckDeps`, so the function is unit-testable
// with mocks and safe to call without a live Postgres/Redis connection. This
// is request-time code (called on every `/health` hit, no caching per D-02),
// not boot-time code, so it must never call `process.exit()`.

export interface DependencyHealth {
  postgres: 'ok' | 'down';
  redis: 'ok' | 'down';
}

export interface HealthCheckDeps {
  queryPostgres: () => Promise<unknown>;
  pingRedis: () => Promise<unknown>;
}

/**
 * Runs both dependency probes concurrently and reports per-dependency
 * reachability. Never throws — a failed probe is reflected as `'down'` in
 * the result, not a rejected promise.
 */
export async function checkDependencyHealth(deps: HealthCheckDeps): Promise<DependencyHealth> {
  const [postgresResult, redisResult] = await Promise.allSettled([
    deps.queryPostgres(),
    deps.pingRedis(),
  ]);

  return {
    postgres: postgresResult.status === 'fulfilled' ? 'ok' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'ok' : 'down',
  };
}
