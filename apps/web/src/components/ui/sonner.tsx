"use client";

// Adapted from Boilerplate:src/app/components/ui/sonner.tsx. The original
// wrapped sonner in next-themes' useTheme() to pick light/dark. This app
// has no theme toggle (no next-themes dependency, no dark-mode switch
// anywhere in apps/web) so the toast theme is pinned to "light" to match
// the site's fixed light design rather than adding next-themes solely for
// this one component.
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
