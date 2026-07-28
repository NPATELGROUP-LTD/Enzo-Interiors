import { useState, useEffect } from "react";

const STORAGE_KEY = "enzo_dark_mode";

export function useDarkMode(defaultDark = false): [boolean, () => void] {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch {
      // localStorage unavailable
    }
    return defaultDark;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(darkMode));
    } catch {
      // localStorage unavailable
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return [darkMode, toggleDarkMode];
}
