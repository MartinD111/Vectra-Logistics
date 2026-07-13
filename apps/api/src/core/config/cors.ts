// ── CORS / Socket.IO allowed-origins allowlist ────────────────────────────
//
// Single source of truth for the browser-origin allowlist consumed by both
// the Express `cors()` middleware and the Socket.IO handshake's `cors.origin`
// option in `server.ts` (HRD-01). Unlike `secrets.ts`, this module is
// request-time, not boot-time: it never calls `process.exit()` and always
// returns an array (possibly empty) — it is up to the caller to decide what
// an empty allowlist means. `process.env` is read lazily, inside the function
// body only (never at module scope), so this module is safe to import before
// `dotenv.config()` runs (e.g. in tests).

/**
 * Resolve the allowed browser origins for CORS + Socket.IO.
 *
 * Primary source: `CORS_ALLOWED_ORIGINS`, a comma-separated list of origins
 * (e.g. `"https://app.vectra.app,https://cmr.vectra.app"`). Each entry is
 * trimmed; empty entries are filtered out.
 *
 * If `CORS_ALLOWED_ORIGINS` is unset or trims to empty, falls back to the
 * defined `NEXT_PUBLIC_MARKETPLACE_URL` / `NEXT_PUBLIC_WORKSPACES_URL` /
 * `NEXT_PUBLIC_CMR_URL` values, in that order.
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (raw) {
    const explicit = raw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    if (explicit.length > 0) {
      return explicit;
    }
  }

  const fallbackVars = [
    process.env.NEXT_PUBLIC_MARKETPLACE_URL,
    process.env.NEXT_PUBLIC_WORKSPACES_URL,
    process.env.NEXT_PUBLIC_CMR_URL,
  ];

  return fallbackVars.filter((value): value is string => !!value);
}
