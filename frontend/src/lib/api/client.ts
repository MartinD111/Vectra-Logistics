const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/** Thrown when the server responds with a non-2xx status. */
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

/** Thrown specifically on 401 so callers can redirect to /auth. */
export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, 'Session expired — please sign in again');
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vectra_token');
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Pass a FormData body directly — Content-Type is left unset so the browser sets the correct multipart boundary. */
  formData?: FormData;
  /** Extra headers merged on top of defaults. */
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, formData, headers: extraHeaders = {} } = options;

  const headers: Record<string, string> = { ...extraHeaders };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Only set Content-Type for JSON bodies; let FormData set its own multipart boundary.
  let resolvedBody: BodyInit | undefined;
  if (formData) {
    resolvedBody = formData;
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
    if (res.status === 401) throw new UnauthorizedError();

    let message = `Request failed with status ${res.status}`;
    try {
      const payload = await res.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Response body was not JSON — keep generic message
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/** Convenience shortcuts */
export const api = {
  get:    <T>(path: string, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'GET', headers }),

  post:   <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body }),

  put:    <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body }),

  patch:  <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: 'POST', formData }),
};
