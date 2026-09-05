import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/api';

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
          caught instanceof ApiError ? caught.message : 'Something went wrong loading this page.',
        );
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void run();
  }, [run]);

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
        setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
        return null;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { mutate, pending, error, clearError: () => setError(null) };
}
