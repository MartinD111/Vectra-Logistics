import { getToken, clearSession } from '@vectra/auth';

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8080';

// ── Error class ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function apiFetch<T>(
  path: string,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let resolvedBody: BodyInit | undefined;

  if (body instanceof FormData) {
    // Let the browser set Content-Type with the correct multipart boundary
    resolvedBody = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    resolvedBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: resolvedBody,
  });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        clearSession();
        // Only redirect if we're not already on the auth page — otherwise a
        // 401 from a component that renders ON /auth (e.g. a shared Navbar)
        // would redirect to /auth and reload forever.
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth';
        }
      }
      // Throw so async callers that await this still get an error boundary
      throw new ApiError(401, 'Session expired — please sign in again');
    }

    let message = `Request failed with status ${res.status}`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Response body was not JSON — keep generic message
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content — nothing to deserialise
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
