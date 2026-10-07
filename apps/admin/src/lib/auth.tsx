import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { LoginResponse, Principal, StaffRole } from '@/types/api';
import { ApiError, UNAUTHORIZED_EVENT, api, deviceStore, tokenStore } from './api';

const USER_CACHE_KEY = 'enzo-admin-user';

/**
 * Last known identity, cached so the app shell can render offline.
 *
 * TRD 11.2 requires the shell to load without a network. That is impossible if
 * the session only exists once /auth/me answers, so the principal is cached and
 * used optimistically on boot, then revalidated. The cache is a convenience,
 * never an authority: the API re-checks the token's role on every request, so a
 * stale cached role grants nothing.
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
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  logout: () => void;
  /** Sign in with a session the API just issued (sign-in, or a password change). */
  adopt: (result: LoginResponse) => void;
  /** Take the API's fresh copy of me (after a name change). */
  update: (user: Principal) => void;
  /** Role check for hiding UI. The API enforces the same rules server-side. */
  can: (...roles: StaffRole[]) => boolean;
  isAdmin: boolean;
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
   * to survive, and logging the user out for it would force a re-login every
   * time the connection blinks.
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

  // A 401 from anywhere in the app drops the session exactly once.
  useEffect(() => {
    const onUnauthorized = () => {
      userCache.write(null);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const adopt = useCallback((result: LoginResponse) => {
    tokenStore.set(result.access_token);
    if (result.deviceToken) deviceStore.set(result.deviceToken);
    userCache.write(result.user);
    setUser(result.user);
  }, []);

  const update = useCallback((next: Principal) => {
    userCache.write(next);
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    userCache.write(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      logout,
      adopt,
      update,
      can: (...roles: StaffRole[]) =>
        user !== null && roles.includes(user.role as StaffRole),
      isAdmin: user?.role === 'Admin',
    }),
    [user, loading, logout, adopt, update],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
