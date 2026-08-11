import { useEffect, useState } from 'react';

const STORAGE_KEY = 'enzo_dark_mode';

/**
 * Tracks dark mode preference and toggles the `.dark` class on <html> so
 * tokens.css's `.dark { ... }` overrides take effect. Persists to
 * localStorage; falls back to `defaultDark` when unavailable (SSR-safe apps
 * should pass a server-known default rather than relying on the fallback).
 */
export function useDarkMode(defaultDark = false): [boolean, () => void] {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      // localStorage unavailable
    }
    return defaultDark;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(STORAGE_KEY, String(darkMode));
    } catch {
      // localStorage unavailable
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return [darkMode, toggleDarkMode];
}
