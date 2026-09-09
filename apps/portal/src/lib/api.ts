/**
 * HTTP client for apps/api.
 *
 * The client portal never reads the datastore directly — everything goes through
 * this file, which is the single place the bearer token is attached and API
 * errors are turned into something a screen can display.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'enzo-portal-token';

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      // Private-mode browsers can throw on access; a missing token is the
      // correct reading of that, and the app falls back to the login screen.
      return null;
    }
  },
  set: (token: string): void => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* Session simply will not survive a reload. Not worth failing the login. */
    }
  },
  clear: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to do */
    }
  },
};

/**
 * An error carrying the API's own message, so forms can show the server's
 * plain-English text ("A client with that email address already exists")
 * instead of a generic failure string.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldMessages: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when the API rejects our token, so the app can bounce to login once. */
export const UNAUTHORIZED_EVENT = 'enzo:unauthorized';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the automatic logout on 401 — used by the login call itself. */
  allowUnauthorized?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, allowUnauthorized = false } = options;
  const token = tokenStore.get();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // A network-level failure is the offline case, and the shell shows a
    // reconnecting state rather than an error page.
    throw new ApiError(
      0,
      'Cannot reach the Enzo API. Check that it is running on ' + BASE_URL + '.',
    );
  }

  if (response.status === 401 && !allowUnauthorized) {
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    // Nest returns `message` as a string, or an array of strings from
    // class-validator. Both need to reach the form.
    const raw = (payload as { message?: string | string[] } | null)?.message;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    throw new ApiError(
      response.status,
      list[0] ?? `Request failed (${response.status})`,
      list,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  baseUrl: BASE_URL,
};
