import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { LoginResponse, Principal } from '@/types/api';
import { ApiError, UNAUTHORIZED_EVENT, api, tokenStore } from './api';

const USER_CACHE_KEY = 'enzo-portal-user';

/**
 * Last known identity, cached so the app shell can render offline.
 *
 * TRD 11.2 requires the shell to load without a network. That is impossible if
 * the session only exists once /auth/me answers, so the principal is cached and
 * used optimistically on boot, then revalidated. The cache is a convenience,
 * never an authority: the API re-checks the token on every request, so a stale
 * cached principal grants nothing.
 */
const userCache = {
  read: (): Principal | null => {
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Principal) : null;
    } catch {
      return null;
    }
  },
  write: (user: Principal | null) => {
    try {
      if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      /* Session simply will not survive a reload. */
    }
  },
};

interface AuthState {
  user: Principal | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed from the cache so the shell renders instantly, and offline.
  const [user, setUser] = useState<Principal | null>(() =>
    tokenStore.get() ? userCache.read() : null,
  );
  const [loading, setLoading] = useState(true);

  /**
   * Revalidate the stored token against the API.
   *
   * Only a genuine 401 ends the session. A network failure must NOT — the API
   * being briefly unreachable is exactly the offline case the shell is supposed
   * to survive, and signing a client out for it would be a poor experience on a
   * phone with patchy signal.
   */
  useEffect(() => {
    let cancelled = false;
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<Principal>('/auth/me')
      .then((principal) => {
        if (cancelled) return;
        setUser(principal);
        userCache.write(principal);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) {
          tokenStore.clear();
          userCache.write(null);
          setUser(null);
        }
        // Any other failure (offline, API down): keep the cached session.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      userCache.write(null);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // The client login flow. Staff credentials are rejected here by design —
    // the API issues separate, non-interchangeable tokens per flow.
    const result = await api.post<LoginResponse>(
      '/auth/portal/login',
      { email, password },
      { allowUnauthorized: true },
    );
    tokenStore.set(result.access_token);
    userCache.write(result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    userCache.write(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
