"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowUpRight,
  Menu,
  X,
  Home as HomeIcon,
  Sofa,
  Image as ImageIcon,
  Users,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextRoll } from "@/components/shared/TextRoll";
import { cn } from "@/lib/utils";

interface NavPanelLink {
  label: string;
  href: string;
  description?: string;
}

interface NavLink {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  panel: {
    tagline: string;
    links: NavPanelLink[];
  };
}

const navLinks: NavLink[] = [
  {
    label: "Home",
    path: "/",
    icon: HomeIcon,
    panel: {
      tagline: "Bespoke interiors, designed around how you live.",
      links: [
        { label: "Our Services", href: "/services", description: "Kitchens, wardrobes, bedrooms & media walls" },
        { label: "Portfolio", href: "/portfolio", description: "Recent projects across Leicester" },
        { label: "Book a Consultation", href: "/booking", description: "A free, no-obligation design visit" },
      ],
    },
  },
  {
    label: "Services",
    path: "/services",
    icon: Sofa,
    panel: {
      tagline: "Fitted furniture, designed and installed end to end.",
      links: [
        { label: "Kitchens", href: "/services/kitchens", description: "Bespoke kitchen design & fit" },
        { label: "Bedrooms", href: "/services/bedrooms", description: "Fitted wardrobes & bedroom suites" },
        { label: "Media Walls", href: "/services/media-walls", description: "Statement living room features" },
        { label: "Wardrobes", href: "/services/wardrobes", description: "Walk-in & fitted storage" },
      ],
    },
  },
  {
    label: "Portfolio",
    path: "/portfolio",
    icon: ImageIcon,
    panel: {
      tagline: "A look inside homes we've transformed.",
      links: [
        { label: "Full Portfolio", href: "/portfolio", description: "Browse every completed project" },
        { label: "Kitchens", href: "/services/kitchens", description: "See kitchen installations" },
        { label: "Bedrooms", href: "/services/bedrooms", description: "See bedroom installations" },
      ],
    },
  },
  {
    label: "About",
    path: "/about",
    icon: Users,
    panel: {
      tagline: "Leicester-based designers & makers.",
      links: [
        { label: "Our Story", href: "/about", description: "How Enzo Interiors began" },
        { label: "Our Process", href: "/services", description: "From consultation to install" },
        { label: "Contact Us", href: "/contact", description: "Speak to the team" },
      ],
    },
  },
  {
    label: "Contact",
    path: "/contact",
    icon: Mail,
    panel: {
      tagline: "Let's talk about your next room.",
      links: [
        { label: "Book a Consultation", href: "/booking", description: "Free design visit, no obligation" },
        { label: "Get in Touch", href: "/contact", description: "Send us your project details" },
      ],
    },
  },
];

// Treatment for the mobile-only pieces (toggle button, mobile menu sheet) —
// dark glass, since mobile has no sand frame to blend into.
const GLASS = "border border-enzo-cream/15 bg-enzo-forest/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]";
// Treatment for the desktop-only pieces that dock against the sand frame
// (logo, center dock, CTA button) — solid sand color (no glassmorphism,
// no blur, fully opaque), matching the frame exactly so they read as one
// continuous border rather than separate components.
const GLASS_LIGHT = "bg-enzo-sand text-enzo-forest";
// Every floating piece shares this height so the row reads as one baseline.
const PIECE_HEIGHT = "h-12";
// Every floating piece shares this corner radius too (logo card, dock, CTA).
const PIECE_RADIUS = "rounded-2xl";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePath, setActivePath] = useState<string | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // The dock's "closed" width has to be a real measured pixel value, not a
  // CSS keyword like `fit-content` — animating `width` between a keyword
  // and a percentage relies on the still-flaky `interpolate-size` CSS
  // feature, which was silently failing to reverse (dock got stuck open
  // with no transition at all). Plain px <-> percent transitions are
  // standard CSS and always animate reliably.
  const linksRowRef = useRef<HTMLDivElement>(null);
  const [closedWidth, setClosedWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = linksRowRef.current;
    if (!el) return;
    const measure = () => setClosedWidth(el.scrollWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The dock's horizontal position/width must be derived from the REAL
  // rendered gap between the logo and CTA, not a guessed inset — the logo
  // and CTA are asymmetric in width (the CTA's label is much wider than the
  // logo mark), and that asymmetry shifts with viewport width too, so no
  // fixed inset can ever be correct for both. useLayoutEffect (not
  // useEffect) avoids a one-frame flash of the dock at its fallback
  // position before the real measurement lands.
  const [dockBox, setDockBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const logoEl = logoRef.current;
    const ctaEl = ctaRef.current;
    if (!logoEl || !ctaEl) return;

    // Fixed breathing room kept clear between the dock and each neighbour,
    // on top of their real measured edges.
    const BREATHING_ROOM = 20;

    const measure = () => {
      const logoRect = logoEl.getBoundingClientRect();
      const ctaRect = ctaEl.getBoundingClientRect();
      // Below md the CTA wrapper is `hidden` (display:none), which reports
      // a zero-size rect — bail out rather than computing garbage insets
      // from it (the dock is hidden below md too, so this only guards
      // against poisoning state with nonsense values).
      if (ctaRect.width === 0) return;

      const left = logoRect.right + BREATHING_ROOM;
      const width = Math.max(0, ctaRect.left - logoRect.right - BREATHING_ROOM * 2);
      setDockBox({ left, width });
    };

    measure();

    // Observe the logo and CTA themselves — NOT the dock. The dock's own
    // width changes as a *result* of the state this effect sets (closed
    // <-> expanded), so observing it would create a feedback loop:
    // resize -> setDockBox -> render -> dock resizes -> resize -> ...
    // Logo/CTA size only changes from viewport width, never from dockBox
    // itself, so they're safe permanent observation targets.
    const ro2 = new ResizeObserver(measure);
    ro2.observe(logoEl);
    ro2.observe(ctaEl);
    window.addEventListener("resize", measure);
    return () => {
      ro2.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Reset mobile menu + hover panel when navigating, per React's "adjusting
  // state on prop change" pattern (https://react.dev/learn/you-might-not-need-an-effect)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setActivePath(null);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const openPanel = (path: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActivePath(path);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActivePath(null), 120);
  };

  const activeLink = navLinks.find((l) => l.path === activePath) ?? null;

  // Keeps rendering the last-open panel's content while the dock collapses,
  // so the CSS grid-rows close transition below never has to shrink toward
  // empty/blank content mid-close. Set during render (not an effect) —
  // same "adjust state on prop change" pattern as pathname/mobileOpen above.
  const [displayedPath, setDisplayedPath] = useState<string | null>(null);
  if (activePath && activePath !== displayedPath) {
    setDisplayedPath(activePath);
  }
  const displayedLink = navLinks.find((l) => l.path === displayedPath) ?? null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
        {/* Logo (left) + CTA / mobile toggle (right) — independent row so
            the center dock below can grow without shifting these. On
            mobile this is a floating gapped row like the dock. On desktop
            these two float with a clean margin off the frame (md:px-7/
            md:pt-6) rather than touching its corners — touching a corner
            left an awkward triangular pocket of bare sand where the
            piece's one free rounded corner met the frame's two straight
            edges, since a corner (unlike the dock's single flat top edge)
            has two adjacent sides for that pocket to open up along.
            md:max-w-none lets the row reach the true viewport edges. */}
        <div className="relative mx-auto flex max-w-[1400px] items-start justify-between px-4 pt-4 md:max-w-none md:px-7 md:pt-6">
          {/* Logo is the one piece visible in both contexts — dark glass +
              white mark on mobile (base classes), solid sand + dark mark
              on desktop (md: overrides + swapped image). Fully rounded on
              all sides now that it floats clear of the frame. */}
          <Link
            ref={logoRef}
            href="/"
            className={cn(
              "relative flex items-center overflow-hidden px-5 pointer-events-auto",
              PIECE_HEIGHT,
              PIECE_RADIUS,
              GLASS,
              "md:border-0 md:bg-enzo-sand md:text-enzo-forest md:backdrop-blur-none md:shadow-none",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed nav mark, not worth next/image's overhead */}
            <img src="/logo/enzo-white.png" alt="Enzo Interiors" className="relative z-10 h-6 w-auto md:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed nav mark, not worth next/image's overhead */}
            <img
              src="/logo/enzo-forest.png"
              alt="Enzo Interiors"
              className="relative z-10 hidden h-6 w-auto md:block"
            />
          </Link>

          <div ref={ctaRef} className="pointer-events-auto hidden md:block">
            {/* variant="outline" gives a bold, unambiguous hover: it
                inverts to a solid forest fill + cream text, rather than a
                translucent tint layered over our custom colors (which was
                muddy and low-contrast — a subtle hover state doesn't read
                against a background this light in the first place). Fully
                rounded now that the CTA floats clear of the frame. The
                hover colors are spelled out explicitly here rather than
                relying on the "outline" variant's own built-in
                hover:bg-primary/hover:text-primary-foreground — those
                never actually painted in testing (present in the class
                list, genuinely `:hover`-matched, yet the computed
                background stayed unchanged), so this takes direct control
                instead of depending on that cascade behaving as expected. */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                "border-enzo-forest/30 bg-enzo-sand text-enzo-forest",
                "transition-all duration-300 ease-out",
                "hover:bg-enzo-forest hover:text-enzo-cream hover:border-enzo-forest",
                "hover:shadow-[0_8px_24px_rgba(28,74,58,0.25)] hover:scale-105",
                PIECE_HEIGHT,
                PIECE_RADIUS,
              )}
            >
              <Link href="/booking">Book a Consultation</Link>
            </Button>
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "pointer-events-auto flex w-12 items-center justify-center text-enzo-cream md:hidden",
              PIECE_HEIGHT,
              PIECE_RADIUS,
              GLASS,
            )}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Center dock — desktop only, absolutely centered independent of
            the logo/CTA row above so its own width never affects them.
            Hugs its content when closed, then smoothly widens to fill the
            available space once a hover panel opens — the actual
            Dynamic-Island move, not just a height reveal. The closed width
            is a real measured pixel value (see closedWidth above) so the
            width transition is a plain, reliable px <-> % animation. On
            desktop it docks against the frame's top edge only
            (md:top-[12px], matching the row above's 2px safety overlap) —
            floating centered, not touching the left/right frame edges. */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-4 hidden justify-center px-4 md:flex md:top-[12px] md:left-[7.5rem] md:right-[7.5rem] md:px-0"
          style={
            dockBox
              ? { left: `${dockBox.left}px`, right: "auto", width: `${dockBox.width}px` }
              : undefined
          }
        >
          <nav
            onMouseLeave={scheduleClose}
            style={{
              width: activeLink
                ? (dockBox?.width ?? "100%")
                : closedWidth != null && dockBox != null
                  ? Math.min(closedWidth, dockBox.width)
                  : (closedWidth ?? undefined),
            }}
            className={cn(
              "pointer-events-auto relative max-w-3xl overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              PIECE_RADIUS,
              GLASS_LIGHT,
              // Flush against the frame's top edge — sharp, no radius, so
              // the flat edge continues the frame's edge exactly.
              "rounded-tl-none rounded-tr-none",
            )}
          >
            <div
              ref={linksRowRef}
              className={cn(
                "relative z-10 mx-auto flex w-fit items-center justify-center gap-0.5 px-2 lg:gap-1 lg:px-3",
                PIECE_HEIGHT,
              )}
            >
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                const isHovered = activePath === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    onMouseEnter={() => openPanel(link.path)}
                    className="relative rounded-2xl px-3 py-2 text-[13px] font-medium tracking-wide whitespace-nowrap text-enzo-forest/80 transition-colors duration-200 hover:text-enzo-forest lg:px-4"
                  >
                    {isHovered && (
                      <motion.span
                        layoutId="nav-hover-pill"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        className="absolute inset-0 rounded-2xl bg-enzo-forest/8"
                      />
                    )}
                    <span className="relative z-10">
                      <TextRoll hovered={isHovered}>{link.label}</TextRoll>
                    </span>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-underline"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        className="absolute bottom-[7px] left-4 right-4 z-10 h-[2px] rounded-full bg-enzo-forest"
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Hover panel — attached below, full dock width. Animated with
                a CSS grid-rows 0fr/1fr transition (not JS height:"auto")
                so it morphs smoothly regardless of content size, and the
                dock's corner radius never changes — only its size — for a
                clean Dynamic-Island-style reveal without any snap. */}
            <div
              className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ gridTemplateRows: activeLink ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                {displayedLink && (
                  <div
                    onMouseEnter={() => openPanel(displayedLink.path)}
                    className={cn(
                      "border-t border-enzo-forest/10 px-7 py-6 transition-opacity duration-300",
                      activeLink ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] lg:gap-0">
                      <div className="pb-6 border-b border-enzo-forest/10 lg:pb-0 lg:border-b-0 lg:pr-10">
                        <div className="flex items-start gap-4">
                          <motion.div
                            key={displayedLink.path}
                            initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 320, damping: 20 }}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-enzo-forest/10 text-enzo-forest"
                          >
                            <displayedLink.icon className="h-5 w-5" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-enzo-forest/50">
                              Explore {displayedLink.label}
                            </p>
                            <p className="text-[14px] leading-snug font-medium text-enzo-forest/75">
                              {displayedLink.panel.tagline}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3 lg:border-l lg:border-enzo-forest/10 lg:pl-10 pt-6 lg:pt-0">
                        {displayedLink.panel.links.map((pl, i) => (
                          <Link
                            key={pl.href + pl.label}
                            href={pl.href}
                            onClick={() => setActivePath(null)}
                            className="group flex flex-col gap-0.5 rounded-2xl px-3 py-2.5 transition-colors duration-200 hover:bg-enzo-forest/8"
                          >
                            <span className="flex items-baseline gap-2">
                              <span className="text-[10px] font-medium tabular-nums text-enzo-forest/40 transition-colors duration-200 group-hover:text-enzo-forest/70">
                                0{i + 1}
                              </span>
                              <span className="flex items-center gap-1 text-[14px] font-medium text-enzo-forest">
                                {pl.label}
                                <ArrowUpRight className="h-3.5 w-3.5 -translate-y-px opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                              </span>
                            </span>
                            {pl.description && (
                              <span className="pl-[22px] text-[12px] leading-snug text-enzo-forest/55 transition-colors duration-200 group-hover:text-enzo-forest/80">
                                {pl.description}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile menu — a plain, direct list. Every main page is one
          full-width row (the whole row is the Link, big label + a "go"
          badge) with nothing else competing for attention — no taglines,
          no chip clutter — so tapping straight through to Home/Services/
          Portfolio/etc. is unmistakable. */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[55] bg-enzo-dark/60 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                "fixed inset-x-4 top-[4.5rem] z-[60] overflow-hidden md:hidden",
                PIECE_RADIUS,
                GLASS,
              )}
            >
              <div className="flex flex-col divide-y divide-enzo-cream/10">
                {navLinks.map((link) => {
                  const isActive = pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      href={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-3 px-5 py-4 active:bg-enzo-cream/[0.08]",
                        isActive && "bg-enzo-cream/[0.06]",
                      )}
                    >
                      <span className="font-serif italic text-[22px] text-enzo-cream">{link.label}</span>
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-enzo-cream/10">
                        <ArrowUpRight className="h-4 w-4 text-enzo-cream" />
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="p-3">
                <Button asChild size="md" className="w-full justify-center">
                  <Link href="/booking" onClick={() => setMobileOpen(false)}>
                    Book a Consultation
                  </Link>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
