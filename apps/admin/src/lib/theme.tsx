import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'enzo-theme';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const stored = (): Theme | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private-mode browsers can throw on access; no stored preference is the
    // correct reading of that.
    return null;
  }
};

const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * Light/dark theme, shared by both authenticated apps.
 *
 * The class is also applied by an inline script in index.html so the correct
 * canvas paints before React mounts; this provider keeps it in sync afterwards
 * and owns the toggle. The storage key is shared with apps/portal deliberately
 * — a user who prefers dark should get dark in both.
 *
 * Only an EXPLICIT choice is written to storage. Persisting the resolved system
 * preference would silently freeze the user into whatever their OS happened to
 * be on first visit, so an untouched app keeps following the OS instead.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => stored() ?? systemTheme());

  // Apply the class. Does not write storage — see the note above.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Follow the OS while the user has not expressed a preference of their own.
  useEffect(() => {
    if (stored()) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (!stored()) setThemeState(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const set = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Preference just will not persist across reloads. */
    }
  }, []);

  const toggle = useCallback(() => {
    set(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }, [set]);

  const value = useMemo<ThemeState>(() => ({ theme, toggle, set }), [theme, toggle, set]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
