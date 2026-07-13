// ── Release version resolution ────────────────────────────────────────────
//
// Single validated-read module for the release version string (REL-01).
// Mirrors secrets.ts's "pure function + cached wrapper" shape, but this read
// is soft/non-fatal — a missing or unreadable VERSION file never crashes the
// process, it falls back to 'unknown'. Used by GET /health for operator
// visibility, and consumed by build tooling as the source of truth.

import fs from 'fs';
import path from 'path';

/**
 * Pure resolver — no side effects, safe to unit test directly. Prefers
 * `envValue` (e.g. `process.env.VERSION`) when set to a non-empty trimmed
 * string; otherwise falls back to reading the version file via the injected
 * `readVersionFile` callback. Returns 'unknown' if neither resolves.
 */
export function resolveVersion(
  envValue: string | undefined,
  readVersionFile: () => string,
): string {
  if (envValue && envValue.trim()) {
    return envValue.trim();
  }
  try {
    return readVersionFile().trim();
  } catch {
    return 'unknown';
  }
}

/** Real filesystem read of the root VERSION file (5 hops: config→core→src→api→apps→root). */
function readRootVersionFile(): string {
  const versionPath = path.join(__dirname, '../../../../../VERSION');
  return fs.readFileSync(versionPath, 'utf-8');
}

let cachedVersion: string | undefined;

/**
 * Cached read of the release version. Resolves once per process lifetime
 * from `process.env.VERSION`, then the root `VERSION` file, then 'unknown'.
 * Never calls `process.exit` — this is a soft, non-fatal read (unlike
 * secrets.ts's `fail()`).
 */
export function getVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }
  cachedVersion = resolveVersion(process.env.VERSION, readRootVersionFile);
  return cachedVersion;
}
