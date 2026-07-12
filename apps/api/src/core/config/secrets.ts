// ── Boot-time secret validation ───────────────────────────────────────────
//
// Single validated-read module for JWT_SECRET and ENCRYPTION_KEY. Both must
// be present, non-empty, and not equal to a known committed/legacy fallback
// value — the server refuses to boot otherwise (SEC-01/SEC-02).
//
// This module is boot-oriented: failures call `console.error` + `process.exit(1)`,
// not `AppError` (which requires an HTTP request context). It is a parallel,
// boot-time complement to `core/crypto/secretBox.ts`'s request-time
// `getEncryptionKey()` — not a replacement for it.

const KNOWN_BAD_JWT_SECRET = 'vectra-dev-secret-key-change-in-production';
const KNOWN_BAD_JWT_SECRET_LEGACY = 'super-secret-key-for-dev';
const KNOWN_BAD_ENCRYPTION_KEY = '204a7160ec31da5e8aa66cdedaff651050c60f78e62001f6b8790c74bf8cda20';

export interface SecretValidationResult {
  valid: boolean;
  reason?: string;
}

/** Pure validator for JWT_SECRET — no side effects, safe to unit test directly. */
export function validateJwtSecretValue(value: string | undefined): SecretValidationResult {
  if (!value) {
    return { valid: false, reason: 'JWT_SECRET is unset or empty' };
  }
  if (value === KNOWN_BAD_JWT_SECRET || value === KNOWN_BAD_JWT_SECRET_LEGACY) {
    return { valid: false, reason: 'JWT_SECRET is set to a known committed/legacy fallback value' };
  }
  return { valid: true };
}

/** Pure validator for ENCRYPTION_KEY — no side effects, safe to unit test directly. */
export function validateEncryptionKeyValue(value: string | undefined): SecretValidationResult {
  if (!value) {
    return { valid: false, reason: 'ENCRYPTION_KEY is unset or empty' };
  }
  if (value.length !== 64) {
    return { valid: false, reason: 'ENCRYPTION_KEY must be a 64-char hex string' };
  }
  if (value === KNOWN_BAD_ENCRYPTION_KEY) {
    return { valid: false, reason: 'ENCRYPTION_KEY is set to a known committed fallback value' };
  }
  return { valid: true };
}

/** Boot-time fatal error: print a clear message and exit before any DB/Redis I/O. */
function fail(varName: string, reason: string): never {
  console.error(`FATAL: invalid ${varName} — ${reason}. Set a real, non-default value before starting the server.`);
  process.exit(1);
}

/**
 * Validated, lazy read of JWT_SECRET. Call inside a function body (never at
 * module scope) so it always runs after dotenv.config() has loaded .env.
 */
export function getJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  const result = validateJwtSecretValue(value);
  if (!result.valid) {
    fail('JWT_SECRET', result.reason ?? 'invalid value');
  }
  return value as string;
}

/**
 * Boot-time gate: validates both JWT_SECRET and ENCRYPTION_KEY, exiting the
 * process with a clear error if either is unset, empty, or a known-bad
 * fallback. Call once, inside bootstrap(), before any DB/Redis connection.
 */
export function validateSecretsOrExit(): void {
  getJwtSecret();

  const encValue = process.env.ENCRYPTION_KEY;
  const encResult = validateEncryptionKeyValue(encValue);
  if (!encResult.valid) {
    fail('ENCRYPTION_KEY', encResult.reason ?? 'invalid value');
  }
}
