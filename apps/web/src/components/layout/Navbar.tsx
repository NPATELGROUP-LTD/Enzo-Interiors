"use client";

// The site header.
//
// Two genuinely separate designs share this file, because they answer two
// different questions.
//
// ── Desktop: a dock that expands into a table of contents ──
// Three floating pieces on the sand frame — logo, centre dock, CTA — where
// pointing at a name widens the dock and drops a panel listing *that page's
// own sections*, anchored — not a grab-bag of links to other pages, which is
// what made the panels interchangeable and therefore pointless. The rows
// themselves are data: src/data/navigation.json.
//
// ── Mobile: a different object in a different palette ──
// The phone menu is not the desktop one reflowed. It is a full-height ink
// sheet in a palette that appears nowhere else on the site — ink, bone and
// brass rather than forest, cream and sand — because it is the one surface
// that completely replaces the page rather than sitting on it, and dressing
// it in the page's own colours only ever made it look like a section that
// had come loose. Brass is not an arbitrary accent either: it is in half the
// project specifications on this site (brass hardware, brass pulls), so the
// menu reads as the brand's ironmongery rather than as a second brand.
//
// It is also flatter than what it replaces: no glass, no blur, no shadow
// stack. One hairline rule under the bar, one column of numbered rows, one
// filled action. Each row opens in place to show that page's sections, so
// the phone gets the same contents the desktop dock gives — the two designs
// differ in everything except what they tell you.
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import {
  ArrowUpRight,
  Home as HomeIcon,
  Sofa,
  Image as ImageIcon,
  Users,
  Mail,
} from "lucide-react";
import { TextRoll } from "@/components/shared/TextRoll";
import type { Company, NavLink, SiteContent } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * The navigation rows carry an icon *name* rather than a component, because
 * they come from src/data/navigation.json. This is the one place that turns a
 * name back into a glyph.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home: HomeIcon,
  Sofa,
  Image: ImageIcon,
  Users,
  Mail,
};

// The phone menu's palette. Deliberately outside the theme tokens — see the
// note at the top of the file. Kept here as one object so the sheet cannot
// drift into forest/cream by accident.
const INK = {
  ground: "#20493A",
  bone: "#F2F0EB",
  boneSoft: "rgba(242,240,235,0.60)",
  brass: "#D4C9B5",
  rule: "rgba(242,240,235,0.16)",
} as const;

// Treatment for the desktop-only pieces that dock against the sand frame
// (logo, center dock, CTA button) — solid sand color (no glassmorphism,
// no blur, fully opaque), matching the frame exactly so they read as one
// continuous border rather than separate components.
const GLASS_LIGHT = "bg-enzo-sand text-enzo-forest";
// Every floating piece shares this height so the row reads as one baseline.
const PIECE_HEIGHT = "h-12";
// Every floating piece shares this corner radius too (logo card, dock, CTA).
const PIECE_RADIUS = "rounded-2xl";

export function Navbar({
  nav,
  content,
  logos,
}: {
  nav: NavLink[];
  content: SiteContent["navbar"];
  logos: Company["logos"];
}) {
  /** The service pages, for the phone sheet's grid. */
  const servicePages = nav.find((l) => l.pages)?.pages ?? [];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activePath, setActivePath] = useState<string | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);

  // The dock's "closed" width has to be a real measured pixel value, not a
  // CSS keyword like `fit-content` — animating `width` between a keyword
  // and a percentage relies on the still-flaky `interpolate-size` CSS
  // feature, which was silently failing to reverse (dock got stuck open
  // with no transition at all). Plain px <-> percent transitions are
  // standard CSS and always animate reliably.
  const linksRowRef = useRef<HTMLDivElement>(null);
  const [closedWidth, setClosedWidth] = useState<number | null>(null);

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
    const linksEl = linksRowRef.current;
    if (!logoEl || !ctaEl || !linksEl) return;

    // Fixed breathing room kept clear between the dock and each neighbour,
    // on top of their real measured edges.
    const BREATHING_ROOM = 20;

    const measure = () => {
      setClosedWidth(linksEl.scrollWidth);

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

    // Observe the links row, the logo and the CTA — NOT the dock. The dock's
    // own width changes as a *result* of the state this effect sets (closed
    // <-> expanded), so observing it would create a feedback loop:
    // resize -> setDockBox -> render -> dock resizes -> resize -> ...
    // These three only change size from viewport width, never from dockBox
    // itself, so they're safe permanent observation targets.
    const ro = new ResizeObserver(measure);
    ro.observe(linksEl);
    ro.observe(logoEl);
    ro.observe(ctaEl);
    // Not redundant with the observer: the dock's box is derived from the
    // logo's and CTA's *positions*, and the CTA is anchored to the right
    // edge. Widening the window moves ctaRect.left without changing the
    // CTA's own size, so ResizeObserver never fires for it.
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // On the homepage only, the navbar starts hidden and HeroSequence
  // reveals it (by flipping document.body's data-hero-chrome attribute)
  // once its scroll sequence reaches the CTA — see .site-navbar in
  // theme.css for the CSS-level instant-hide fallback and HeroSequence.tsx
  // for what sets the attribute. This effect owns the actual reveal/hide
  // *animation*: each piece gets its own distinct motion (the dock slides
  // down sharply, the logo scales in with an overshoot, the CTA button
  // slides in from the right) rather than a single uniform fade — a plain
  // opacity transition read as flat for something meant to feel like the
  // site "arriving". Transform is used only for the transient animation
  // itself, never as the resting hidden state, so it can't skew the
  // logo/CTA getBoundingClientRect() measurements the effect above depends
  // on (that effect only re-measures on resize/size change, never on this
  // transform, but keeping the resting state transform-free avoids any
  // chance of a stale measurement if both ever raced).
  useEffect(() => {
    if (pathname !== "/") return;
    const dock = dockRef.current;
    const logo = logoRef.current;
    const cta = ctaRef.current;
    if (!dock || !logo || !cta) return;

    gsap.set(dock, { yPercent: -130, opacity: 0 });
    gsap.set(logo, { opacity: 0, scale: 0.8 });
    gsap.set(cta, { opacity: 0, x: 28 });

    let entered = false;

    function reveal() {
      if (entered) return;
      entered = true;
      gsap
        .timeline()
        .to(dock, { yPercent: 0, opacity: 1, duration: 0.55, ease: "power4.out" }, 0)
        .to(logo, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" }, 0.08)
        .to(cta, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, 0.18);
    }

    function hide() {
      if (!entered) return;
      entered = false;
      gsap
        .timeline()
        .to(cta, { opacity: 0, x: 28, duration: 0.28, ease: "power2.in" }, 0)
        .to(logo, { opacity: 0, scale: 0.8, duration: 0.28, ease: "power2.in" }, 0)
        .to(dock, { yPercent: -130, opacity: 0, duration: 0.32, ease: "power2.in" }, 0);
    }

    function sync() {
      const state = document.body.dataset.heroChrome;
      if (state === "visible") reveal();
      else if (state === "hidden") hide();
    }

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-hero-chrome"] });
    sync();

    return () => observer.disconnect();
  }, [pathname]);

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

  // Lock body scroll while the full-screen mobile menu is open — this is a
  // real full-viewport takeover, not a floating card, so the page behind it
  // must not scroll independently.
  useEffect(() => {
    if (!mobileOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  // Escape closes the menu, matching the panel's dialog-like takeover of
  // the screen.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // "exit" mirrors "hidden" but staggers in reverse (last row leaves
  // first) with a quicker, delay-free transition — closing should feel
  // snappier than the opening reveal, not just play it backwards.
  const menuListVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
    exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
  };
  const menuItemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as const } },
    exit: { opacity: 0, y: 16, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const } },
  };
  const ctaVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as const, delay: 0.3 } },
    exit: { opacity: 0, y: 16, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const } },
  };

  const openPanel = (path: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActivePath(path);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActivePath(null), 120);
  };

  const activeLink = nav.find((l) => l.path === activePath) ?? null;

  // Keeps rendering the last-open panel's content while the dock collapses,
  // so the CSS grid-rows close transition below never has to shrink toward
  // empty/blank content mid-close. Set during render (not an effect) —
  // same "adjust state on prop change" pattern as pathname/mobileOpen above.
  const [displayedPath, setDisplayedPath] = useState<string | null>(null);
  if (activePath && activePath !== displayedPath) {
    setDisplayedPath(activePath);
  }
  const displayedLink = nav.find((l) => l.path === displayedPath) ?? null;
  const DisplayedIcon = displayedLink ? ICONS[displayedLink.icon] : null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70]">
        {/* Logo (left) + CTA / mobile toggle (right) — independent row so
            the center dock below can grow without shifting these. On
            mobile this is a floating gapped row like the dock. On desktop
            these two float with a clean margin off the frame (md:px-7/
            md:pt-6) rather than touching its corners — touching a corner
            left an awkward triangular pocket of bare sand where the
            piece's one free rounded corner met the frame's two straight
            edges, since a corner (unlike the dock's single flat top edge)
            has two adjacent sides for that pocket to open up along.
            md:max-w-none lets the row reach the true viewport edges.

            Deliberately NOT on `.shell`. Every section below is a centred
            1500px column, and putting the header on the same measure dragged
            the logo and the CTA inward with it — on a 1900px screen they
            ended up 200px in from the edges, floating in the middle of the
            frame instead of sitting on it. The header is chrome docked to the
            sand border, not content in the column: it belongs to the viewport
            and keeps its own 28px inset from it, which is 14px clear of the
            frame's own 14px band. */}
        <div className="relative mx-auto flex max-w-[1400px] items-start justify-between px-4 pt-4 md:max-w-none md:px-7 md:pt-6">
          {/* Same box, always — height/radius/padding never change, only
              the fill does. Sand + forest mark over the page; once the ink
              sheet is behind it the sand pill would sit on top of its own
              backdrop, so the fill drops to transparent and the mark swaps
              to the white cut instead of dimming a dark mark on dark ink. */}
          <Link
            ref={logoRef}
            href="/"
            className={cn(
              "relative flex items-center overflow-hidden pointer-events-auto px-5 transition-colors duration-300",
              PIECE_HEIGHT,
              PIECE_RADIUS,
              mobileOpen ? "bg-transparent" : "bg-enzo-sand",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed nav mark, not worth next/image's overhead */}
            <img
              src={mobileOpen ? logos.onDark.src : logos.onLight.src}
              alt={mobileOpen ? logos.onDark.alt : logos.onLight.alt}
              className="relative z-10 h-6 w-auto"
            />
          </Link>

          <div ref={ctaRef} className="pointer-events-auto hidden md:block">
            {/* The hover inverts to a solid forest fill + cream text. A
                translucent tint reads as muddy and low-contrast against a
                background this light, so every hover colour is spelled out
                explicitly rather than tinting the base. */}
            <Link
              href="/booking"
              className={cn(
                "inline-flex items-center justify-center gap-2 px-6 py-2.5 text-[13px] tracking-wide",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "border border-enzo-forest/30 bg-enzo-sand text-enzo-forest",
                "transition-all duration-300 ease-out",
                "hover:bg-enzo-forest hover:text-enzo-cream hover:border-enzo-forest",
                "hover:shadow-[0_8px_24px_rgba(16,46,45,0.25)] hover:scale-105",
                PIECE_HEIGHT,
                PIECE_RADIUS,
              )}
            >
              {content.ctaLabel}
            </Link>
          </div>

          {/* Same square, open or closed — only the fill and the glyph
              inside animate. A three-bar hamburger morphs into an X in
              place (middle bar fades, top/bottom rotate to meet at the
              centre). The three bars sit at 0 / 7 / 14px in a 16px box —
              whole pixels, not the 6.25px fractional offsets the previous
              version used, which put the middle and bottom bars on a
              sub-pixel boundary the browser anti-aliased into a visibly
              fainter line than the top one. */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "pointer-events-auto flex w-12 items-center justify-center transition-colors duration-300 md:hidden",
              PIECE_HEIGHT,
              PIECE_RADIUS,
              mobileOpen ? "bg-transparent text-enzo-cream" : "bg-enzo-sand text-enzo-forest",
            )}
            aria-label={mobileOpen ? content.closeMenuLabel : content.openMenuLabel}
            aria-expanded={mobileOpen}
          >
            <span aria-hidden="true" className="relative block h-4 w-[18px]">
              <span
                className="absolute inset-x-0 top-0 block h-[2px] origin-center bg-current transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ transform: mobileOpen ? "translateY(7px) rotate(45deg)" : "none" }}
              />
              <span
                className="absolute inset-x-0 top-1/2 block h-[2px] -translate-y-1/2 bg-current transition-opacity duration-200"
                style={{ opacity: mobileOpen ? 0 : 1 }}
              />
              <span
                className="absolute inset-x-0 bottom-0 block h-[2px] origin-center bg-current transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ transform: mobileOpen ? "translateY(-7px) rotate(-45deg)" : "none" }}
              />
            </span>
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
            ref={dockRef}
            onMouseLeave={scheduleClose}
            style={{
              width: activeLink
                ? (dockBox?.width ?? "100%")
                : closedWidth != null && dockBox != null
                  ? Math.min(closedWidth, dockBox.width)
                  : (closedWidth ?? undefined),
            }}
            className={cn(
              "pointer-events-auto relative max-w-5xl overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
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
              {nav.map((link) => {
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
                    {/* ── The panel ──
                        The first version put the page's name and tagline in a
                        left rail and squeezed the contents into whatever was
                        left: at the dock's width that gave each section cell
                        about 180px, so half the labels wrapped onto two lines
                        and the descriptions under them stopped lining up with
                        anything. A menu that is harder to scan than the page
                        it describes is not doing its job.

                        The rail is a header row now. It costs one line and it
                        hands the full width back to the contents, which is
                        what actually needed the room — three columns of ~300px
                        where every label sits on one line and every row shares
                        a baseline. */}
                    <div>
                      <div className="flex items-center gap-3 pb-5">
                        <motion.span
                          key={displayedLink.path}
                          initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 20 }}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-enzo-forest/10 text-enzo-forest"
                        >
                          {DisplayedIcon && <DisplayedIcon className="h-4 w-4" />}
                        </motion.span>
                        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-enzo-forest-light">
                          {displayedLink.label}
                        </p>
                        {/* No rule between the label and the tagline. The
                            panel already has one directly beneath this row,
                            separating the header from the contents, and a
                            second hairline on the same axis 20px above it read
                            as a repeat rather than as structure. `ml-auto`
                            does the job the rule was doing — holding the
                            tagline to the right — without drawing anything. */}
                        <p className="ml-auto truncate text-[12.5px] text-enzo-forest/70">
                          {displayedLink.tagline}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "grid gap-x-8 border-t border-enzo-forest/10 pt-5",
                          // Services is the only item with child pages, and
                          // they get a column of their own rather than being
                          // mixed into the section list — a page and a place
                          // on a page are different promises.
                          displayedLink.pages
                            ? "lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.15fr)]"
                            : "lg:grid-cols-1",
                        )}
                      >
                        {displayedLink.pages && (
                          <>
                            <div>
                              <p className="font-display mb-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-enzo-forest/45">
                                {content.servicePagesLabel}
                              </p>
                              <ul className="grid grid-cols-2 gap-x-2">
                                {displayedLink.pages.map((page) => (
                                  <li key={page.href}>
                                    <Link
                                      href={page.href}
                                      onClick={() => setActivePath(null)}
                                      className="group flex flex-col gap-0.5 rounded-2xl px-3 py-2.5 transition-colors duration-200 hover:bg-enzo-forest/8"
                                    >
                                      <span className="flex items-center gap-1.5 text-[14px] font-medium text-enzo-forest">
                                        {page.label}
                                        <ArrowUpRight className="h-3.5 w-3.5 -translate-y-px opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                                      </span>
                                      <span className="text-[11.5px] leading-snug text-enzo-forest/60">
                                        {page.description}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <span
                              aria-hidden="true"
                              className="hidden bg-enzo-forest/10 lg:block"
                            />
                          </>
                        )}

                        {/* The page's own contents, in the order they appear
                            on it — each row carrying the sheet index the page
                            itself prints beside that section, so the panel and
                            the page use one numbering. */}
                        <div className={displayedLink.pages ? "lg:pl-8" : undefined}>
                          <p className="font-display mb-2 px-3 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-enzo-forest/45">
                            {content.sectionsLabel}
                          </p>
                          <ul
                            className={cn(
                              "grid gap-x-4",
                              displayedLink.pages
                                ? "grid-cols-2 lg:grid-cols-2"
                                : "grid-cols-2 lg:grid-cols-3",
                            )}
                          >
                            {displayedLink.sections.map((section) => (
                              <li key={section.href}>
                                <Link
                                  href={section.href}
                                  onClick={() => setActivePath(null)}
                                  className="group flex items-baseline gap-2.5 rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-enzo-forest/8"
                                >
                                  <span className="font-display w-5 shrink-0 text-[10px] font-semibold tabular-nums tracking-[0.12em] text-enzo-forest-light">
                                    {section.index}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="flex items-center gap-1 text-[13.5px] font-medium leading-[1.35] text-enzo-forest">
                                      {section.label}
                                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                                    </span>
                                    <span className="block truncate text-[11.5px] leading-snug text-enzo-forest/60">
                                      {section.description}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* ── The phone sheet ──
          Ink, bone and brass; no glass, no blur, no shadow stack. It wipes
          down from under the bar as a clip rather than fading, so it reads
          as a panel sliding over the page rather than the page dissolving.

          It sits at z-[60], under the fixed bar's z-[70], so the mark and
          the same control stay put and the control simply becomes "Close" —
          one object changing state, not two objects swapping places.

          Each page row opens in place to list that page's own sections, so
          the phone carries exactly the contents the desktop dock does. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{
              clipPath: "inset(0% 0% 0% 0%)",
              transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
            }}
            exit={{
              clipPath: "inset(0% 0% 100% 0%)",
              transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1], delay: 0.05 },
            }}
            role="dialog"
            aria-modal="true"
            aria-label={content.menuLabel}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto md:hidden"
            style={{ backgroundColor: INK.ground }}
          >
            <div className="relative flex min-h-full flex-col px-6 pb-10 pt-24">
              {/* The rule the bar sits on. It is the sheet's only chrome. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-6 top-[4.5rem] block h-px"
                style={{ backgroundColor: INK.rule }}
              />

              <motion.nav
                variants={menuListVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col pt-4"
              >
                {nav.map((link, i) => {
                  const isHere = pathname === link.path;
                  return (
                    <motion.div
                      key={link.path}
                      variants={menuItemVariants}
                      className="border-b"
                      style={{ borderColor: INK.rule }}
                    >
                      <Link
                        href={link.path}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-baseline gap-4 py-4 active:opacity-60"
                      >
                        {/* Where you already are, said by stamping its own
                            index rather than a colour shift on the label no
                            one would notice, or a dot that could mean
                            anything. The number every row already carries
                            becomes the mark: on the current page it fills
                            solid brass, like a die stamped into the sheet. */}
                        <span
                          className="font-display flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1 text-[10.5px] font-semibold tabular-nums tracking-[0.1em] transition-colors duration-300"
                          style={{
                            color: isHere ? INK.ground : INK.boneSoft,
                            backgroundColor: isHere ? INK.brass : "transparent",
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="font-title text-[2rem] font-semibold leading-none tracking-[-0.04em]"
                          style={{ color: INK.bone }}
                        >
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.nav>

              {/* The four services, flat. They were behind a per-row
                  expander before, which meant the one thing most visitors
                  open the menu for took two taps and a guess at which row
                  hid it. A menu this short has the room to just show them. */}
              {servicePages.length > 0 && (
                <motion.div
                  variants={ctaVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="pt-8"
                >
                  <p
                    className="font-display pb-3 text-[9.5px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: INK.boneSoft }}
                  >
                    {content.mobileServicesLabel}
                  </p>
                  <ul
                    className="grid grid-cols-2 border-t border-l"
                    style={{ borderColor: INK.rule }}
                  >
                    {servicePages.map((page) => (
                      <li key={page.href} className="border-b border-r" style={{ borderColor: INK.rule }}>
                        <Link
                          href={page.href}
                          onClick={() => setMobileOpen(false)}
                          className="block px-3 py-3.5 text-[13px] active:opacity-60"
                          style={{ color: INK.bone }}
                        >
                          {page.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              <motion.div
                variants={ctaVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="mt-auto pt-10"
              >
                <Link
                  href="/booking"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between gap-4 rounded-full py-3 pl-7 pr-3 text-[15px] font-medium active:scale-[0.985]"
                  style={{ backgroundColor: INK.brass, color: INK.ground }}
                >
                  {content.mobileCtaLabel}
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: INK.ground, color: INK.brass }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
