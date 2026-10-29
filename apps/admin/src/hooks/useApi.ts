import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the request. Safe to call from an event handler. */
  refetch: () => Promise<void>;
  /** Patch the local copy after a mutation, avoiding a full round trip. */
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

/**
 * Minimal GET hook.
 *
 * Every list and detail screen needs the same three states — loading, error,
 * loaded — and the brief requires all of them to be handled. Centralising the
 * shape here is what stops a screen quietly rendering an empty table while a
 * request is still in flight.
 *
 * `path` is the dependency: pass a stable string (or one derived from route
 * params) and the hook refetches when it changes.
 */
export function useQuery<T>(path: string | null): QueryState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow earlier response overwriting a newer one when the
  // path changes quickly (switching clients in a list, for example).
  const requestId = useRef(0);

  const run = useCallback(async () => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      if (id === requestId.current) setDataState(result);
    } catch (caught) {
      if (id === requestId.current) {
        setError(
          caught instanceof ApiError ? caught.message : 'We could not load this. Please try again.',
        );
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void run();
  }, [run]);

  // Keep what is on screen current without a reload: when the API says something changed (it pings
  // after any write), when the tab comes back into view, and once a minute as a fallback. Quiet:
  // no spinner, and a failed refresh keeps what is shown.
  useEffect(() => {
    if (path === null) return;
    let timer: number | undefined;
    const quiet = async () => {
      const id = ++requestId.current;
      try {
        const result = await api.get<T>(path);
        // Same content keeps the same object, so a form seeded from `data` is not reset mid-edit.
        if (id === requestId.current)
          setDataState((cur) => (JSON.stringify(cur) === JSON.stringify(result) ? cur : result));
      } catch {
        /* keep the stale copy */
      } finally {
        // This call superseded an in-flight run(), which will skip its own setLoading(false).
        if (id === requestId.current) setLoading(false);
      }
    };
    const soon = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void quiet(), 600);
    };
    const socket = connectSocket();
    socket?.on('data:changed', soon);
    window.addEventListener('focus', soon);
    document.addEventListener('visibilitychange', soon);
    const poll = window.setInterval(soon, 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      socket?.off('data:changed', soon);
      window.removeEventListener('focus', soon);
      document.removeEventListener('visibilitychange', soon);
    };
  }, [path]);

  const setData = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setDataState((current) =>
      typeof updater === 'function' ? (updater as (c: T | null) => T | null)(current) : updater,
    );
  }, []);

  return { data, loading, error, refetch: run, setData };
}

/**
 * Wrap a mutation so a screen gets `pending` and a normalised error message
 * without repeating try/catch in every handler.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
        return null;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { mutate, pending, error, clearError: () => setError(null) };
}
