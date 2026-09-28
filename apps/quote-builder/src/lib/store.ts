"use client";

// localStorage-backed stores for the prototype, read through
// useSyncExternalStore — the same mechanism src/lib/consent.ts uses, so there
// is no state library to add. When apps/api exists these become fetches;
// nothing that calls the hooks below needs to know.
//
// The catalogue store listens for the `storage` event, so an admin editing
// boards in one tab reprices the planner open in another.
import { useSyncExternalStore } from "react";
import { CATALOGUE_VERSION, emptyPlan, seedCatalogue } from "./seed";
import type { Catalogue, Plan, SavedEstimate } from "./types";

interface Store<T> {
  useValue: () => T;
  read: () => T;
  /** Returns false when the browser refuses the write (storage full or blocked). */
  write: (next: T) => boolean;
  update: (fn: (prev: T) => T) => boolean;
  reset: () => void;
}

function createStore<T>(key: string, fallback: () => T, accept: (value: unknown) => value is T): Store<T> {
  const initial = fallback();
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;

  const notify = () => listeners.forEach((listener) => listener());

  const read = (): T => {
    if (typeof window === "undefined") return initial;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return cache?.value ?? initial;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = initial;
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (accept(parsed)) value = parsed;
      } catch {
        // Unreadable data falls back to the seed rather than breaking the page.
      }
    }
    cache = { raw, value };
    return value;
  };

  const write = (next: T): boolean => {
    const raw = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      return false;
    }
    cache = { raw, value: next };
    notify();
    return true;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return {
    useValue: function useValue() {
      return useSyncExternalStore(subscribe, read, () => initial);
    },
    read,
    write,
    update: (fn) => write(fn(read())),
    reset: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing stored, nothing to clear.
      }
      cache = null;
      notify();
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const catalogueStore = createStore<Catalogue>(
  "enzo.quote-builder.catalogue",
  seedCatalogue,
  (value): value is Catalogue =>
    isObject(value) &&
    value.version === CATALOGUE_VERSION &&
    Array.isArray(value.boards) &&
    Array.isArray(value.units) &&
    Array.isArray(value.roomTypes) &&
    isObject(value.settings),
);

export const planStore = createStore<Plan>(
  "enzo.quote-builder.plan",
  emptyPlan,
  (value): value is Plan => isObject(value) && isObject(value.room) && Array.isArray(value.units),
);

export const estimatesStore = createStore<SavedEstimate[]>(
  "enzo.quote-builder.estimates",
  () => [],
  (value): value is SavedEstimate[] => Array.isArray(value),
);

export const useCatalogue = () => catalogueStore.useValue();
export const usePlan = () => planStore.useValue();
export const useEstimates = () => estimatesStore.useValue();

const noopSubscribe = () => () => {};

/** False during the server render and hydration, true after — for anything that must wait for saved data. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
