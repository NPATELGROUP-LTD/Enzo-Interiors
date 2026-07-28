import { useEffect } from "react";
import { useLocation } from "react-router";

interface UseScrollToTopOptions {
  smooth?: boolean;
  delay?: number;
  enabled?: boolean;
}

/**
 * Custom hook that scrolls to the top of the page when the route changes.
 *
 * @param options - Configuration options for scroll behavior
 * @param options.smooth - Use smooth scrolling animation (default: false)
 * @param options.delay - Delay in milliseconds before scrolling (default: 0)
 * @param options.enabled - Enable/disable the scroll behavior (default: true)
 *
 * @example
 * ```tsx
 * // Basic usage
 * useScrollToTop();
 *
 * // With smooth scrolling
 * useScrollToTop({ smooth: true });
 *
 * // With delay
 * useScrollToTop({ delay: 100 });
 * ```
 */
export function useScrollToTop(options: UseScrollToTopOptions = {}) {
  const { smooth = false, delay = 0, enabled = true } = options;
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: smooth ? "smooth" : "auto",
      });
    };

    if (delay > 0) {
      const timeoutId = setTimeout(scrollToTop, delay);
      return () => clearTimeout(timeoutId);
    } else {
      scrollToTop();
    }
  }, [location.pathname, location.search, smooth, delay, enabled]);
}
