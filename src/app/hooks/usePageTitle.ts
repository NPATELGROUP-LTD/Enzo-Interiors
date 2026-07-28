import { useEffect } from "react";

/**
 * Custom hook to set the page title dynamically
 * @param title - The title to set for the page
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
