"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/quick", label: "Quick estimate" },
  { href: "/plan", label: "Room planner" },
];

/**
 * Chrome for every screen. The root layout's sand frame is 14px wide from md
 * up and sits above everything, so the shell is inset by the same amount
 * rather than letting the frame cover its edges.
 */
export function ToolShell({
  section,
  children,
  actions,
  fixedHeight = false,
  badge,
}: {
  section: string;
  children: ReactNode;
  actions?: ReactNode;
  /** App-style screens (the planner) fill the viewport on large screens and scroll inside their panels. */
  fixedHeight?: boolean;
  /** Marks staff-only screens and views. */
  badge?: string;
}) {
  const pathname = usePathname();
  return (
    <div className={cn("flex flex-col bg-background md:p-[14px]", fixedHeight ? "min-h-dvh lg:h-dvh" : "min-h-dvh")}>
      <header className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border/70 px-5 py-2 md:px-8">
        <Link
          href="/"
          className="font-title text-[17px] font-semibold tracking-[-0.02em] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Enzo Interiors
        </Link>
        <span className="text-[13px] text-muted-foreground">{section}</span>
        {badge ? (
          <span className="rounded-full bg-enzo-sand px-2.5 py-0.5 text-[11px] font-medium text-enzo-forest">{badge}</span>
        ) : null}
        <nav aria-label="Estimate tools" className="ml-auto flex items-center gap-5 text-[13px]">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target hidden underline-offset-[6px] transition-colors sm:inline",
                  active ? "text-primary underline decoration-primary" : "text-muted-foreground hover:text-primary",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {actions}
          <a href={SITE_URL} className="touch-target text-muted-foreground hover:text-primary">
            Back to site
          </a>
        </nav>
      </header>
      <div className={cn("flex-1", fixedHeight && "lg:min-h-0")}>{children}</div>
    </div>
  );
}
