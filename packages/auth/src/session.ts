// Shared session storage for SSO across the Marketplace, Workspaces, and CMR
// apps. The token is the single source of truth, stored in a cookie so all
// three apps on the same host share it.
//
// Dev: a host-only cookie on `localhost` is shared across ports (3000/3001/3002).
// Prod: the cookie is scoped to the parent domain (e.g. `.vectra.app`) so it is
// shared across subdomains. A localStorage mirror is kept as a fallback for
// environments where cookies are unavailable and so existing reads keep working.

const TOKEN_KEY = 'vectra_token';
const USER_KEY = 'vectra_user';

/**
 * Cookie domain attribute for the session cookie. In production set
 * NEXT_PUBLIC_COOKIE_DOMAIN to the parent domain (e.g. ".vectra.app"). In dev,
 * leave it unset to get a host-only cookie on localhost (shared across ports).
 */
const COOKIE_DOMAIN =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN : undefined;

function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    `max-age=${maxAgeSeconds}`,
    'samesite=lax',
  ];
  if (COOKIE_DOMAIN) parts.push(`domain=${COOKIE_DOMAIN}`);
  if (isSecureContext()) parts.push('secure');
  document.cookie = parts.join('; ');
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=`, 'path=/', 'max-age=0'];
  if (COOKIE_DOMAIN) parts.push(`domain=${COOKIE_DOMAIN}`);
  document.cookie = parts.join('; ');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// 24h, matching the backend JWT_EXPIRES_IN.
const SESSION_MAX_AGE = 60 * 60 * 24;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return readCookie(TOKEN_KEY) ?? window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = readCookie(USER_KEY) ?? window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: unknown): void {
  if (typeof window === 'undefined') return;
  const userJson = JSON.stringify(user);
  writeCookie(TOKEN_KEY, token, SESSION_MAX_AGE);
  writeCookie(USER_KEY, userJson, SESSION_MAX_AGE);
  // localStorage mirror (fallback + backwards compatibility)
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, userJson);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  deleteCookie(TOKEN_KEY);
  deleteCookie(USER_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
