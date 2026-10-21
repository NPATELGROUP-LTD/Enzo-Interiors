/**
 * HTTP client for apps/api.
 *
 * The admin portal never reads the datastore directly — everything goes through
 * this file, which is the single place the bearer token is attached and API
 * errors are turned into something a screen can display.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'enzo-admin-token';

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
 * The "remember this device" token. Kept apart from the session on purpose:
 * logout clears the session, never this, so the device stays remembered.
 */
export const deviceStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem('enzo.deviceToken');
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      localStorage.setItem('enzo.deviceToken', token);
    } catch {
      /* The device just is not remembered. */
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

/**
 * What a person reads when a request fails. The API's own plain-English
 * message wins for 4xx; a server fault ("Internal server error") never
 * reaches the screen as-is.
 */
const FALLBACK_MESSAGES: Record<number, string> = {
  403: "You don't have access to this.",
  404: "We couldn't find that.",
  429: 'Too many attempts. Please wait a moment and try again.',
};
function friendlyMessage(status: number, apiMessage?: string): string {
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return apiMessage ?? FALLBACK_MESSAGES[status] ?? 'That did not work. Please try again.';
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

  // A FormData body (a file upload) goes as-is: the browser sets the multipart boundary.
  const json = body !== undefined && !(body instanceof FormData);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: json ? JSON.stringify(body) : (body as FormData) } : {}),
    });
  } catch {
    // A network-level failure is the offline case, and the shell shows a
    // reconnecting state rather than an error page.
    throw new ApiError(0, 'Could not reach Enzo Interiors. Check your connection and try again.');
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
    throw new ApiError(response.status, friendlyMessage(response.status, list[0]), list);
  }

  return payload as T;
}

/** True once the stored token is past half its life and not yet expired. A JWT's claims are readable by design. */
function renewalDue(token: string): boolean {
  try {
    const { iat, exp } = JSON.parse(atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { iat: number; exp: number };
    const now = Date.now() / 1000;
    return now < exp && now > iat + (exp - iat) / 2;
  } catch {
    return false;
  }
}

/**
 * Swap a token past half its life for a fresh one (POST /auth/refresh), so the
 * short-lived token the API issues does not sign anyone out mid-use. Returns
 * the new token, or null when nothing was due or the call failed: a failure is
 * not worth a logout, the token simply runs out and the next request signs out.
 */
export async function renewSession(): Promise<string | null> {
  const token = tokenStore.get();
  if (!token || !renewalDue(token)) return null;
  try {
    const result = await request<{ access_token: string }>('/auth/refresh', { method: 'POST', allowUnauthorized: true });
    tokenStore.set(result.access_token);
    return result.access_token;
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  baseUrl: BASE_URL,
};
