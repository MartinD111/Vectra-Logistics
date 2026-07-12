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

// ── Boot-time DEPLOYMENT_MODE validation (D-02/D-04) ─────────────────────
//
// `DEPLOYMENT_MODE` is a trusted (operator-set) input, not user input, but is
// still exact-match validated so a misconfigured or garbage value can never
// silently fall through to either cloud or on-prem behavior. Read once per
// process lifetime and cached, mirroring the JWT_SECRET/ENCRYPTION_KEY shape.

export type DeploymentMode = 'cloud' | 'on-prem';

let cachedDeploymentMode: DeploymentMode | undefined;

/** Pure validator for DEPLOYMENT_MODE — no side effects, safe to unit test directly. */
export function validateDeploymentModeValue(value: string | undefined): SecretValidationResult {
  if (!value) {
    return { valid: false, reason: 'DEPLOYMENT_MODE is unset or empty' };
  }
  if (value !== 'cloud' && value !== 'on-prem') {
    return {
      valid: false,
      reason: `DEPLOYMENT_MODE must be exactly "cloud" or "on-prem", got "${value}"`,
    };
  }
  return { valid: true };
}

/**
 * Validated, cached read of DEPLOYMENT_MODE. Reads and validates
 * `process.env.DEPLOYMENT_MODE` exactly once per process lifetime; every
 * subsequent call returns the cached value regardless of later env mutation
 * (T-16-03 — prevents access-control behavior from flipping mid-process).
 */
export function getDeploymentMode(): DeploymentMode {
  if (cachedDeploymentMode !== undefined) {
    return cachedDeploymentMode;
  }
  const value = process.env.DEPLOYMENT_MODE;
  const result = validateDeploymentModeValue(value);
  if (!result.valid) {
    fail('DEPLOYMENT_MODE', result.reason ?? 'invalid value');
  }
  cachedDeploymentMode = value as DeploymentMode;
  return cachedDeploymentMode;
}

/**
 * Boot-time gate: validates DEPLOYMENT_MODE, exiting the process with a
 * clear error if unset, empty, or not exactly "cloud"/"on-prem". Call once,
 * inside bootstrap(), alongside validateSecretsOrExit().
 */
export function validateDeploymentModeOrExit(): void {
  getDeploymentMode();
}
