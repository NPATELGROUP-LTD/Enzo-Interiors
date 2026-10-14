"use client";

// Page transitions — "The Fitted Run".
//
// ── The idea ──
// The obvious transition for a site full of technical drawings is another
// technical drawing: a sheet wipes over, a datum line draws itself, a title
// block stamps the destination. That is an *architect's* object, and it says
// draughtsman rather than the thing this company actually sells.
//
// What Enzo sells is stated on its own homepage: "Fitted furniture, made for
// your walls." So the transition is that sentence as motion. Five tall
// panels — a run of doors — are lifted into an opening, alternate ones
// dropping from the head and rising from the base the way a fitter actually
// works along a wall. They meet on shadow gaps: the dark few-millimetre
// reveal that high-end fitted furniture uses instead of handles, and the one
// detail that most reliably separates a made-to-measure run from a flat-pack
// one. A sand rail draws across the closed run and the destination plate
// hangs from it, so the two marks read as one piece of hardware with its
// label applied rather than as two unrelated stamps.
//
// The panels are five slightly different greens, not one. A real run is cut
// from consecutive leaves of the same veneer and no two doors take the light
// identically; five identical rectangles read as a loading screen, five
// related ones read as material.
//
// ── The panels never reverse ──
// A panel that arrived from the head continues down and out; one that
// arrived from the base continues up and out. Nothing retraces its path, so
// the run is fitted and then lifted away rather than wiped on and wiped off,
// and the new page is revealed from a horizontal band outward instead of
// from one edge. The order of travel along the wall is spatial: moving
// forward through the header (its order is src/data/navigation.json) fits the run left to
// right, moving back fits it right to left.
//
// ── Cover first, navigate second ──
// This is the part that has to be right, and the naive version gets it
// backwards. If the transition is driven by `usePathname()` — play whenever
// the path changes — then the router has *already* swapped the tree by the
// time the first panel moves: the reader sees a flash of the new page, still
// bare because none of its own reveals have run, and only then does a run of
// doors close over it and open again on the same page. The cover has nothing
// left to hide.
//
// So navigation is driven from the click instead. A capture-phase listener
// takes the click before Next's <Link> sees it and calls preventDefault();
// Link runs its own onClick (which is how the mobile menu still closes) and
// then bails out on `defaultPrevented`, so nothing navigates yet. The run
// closes over the page the reader is still looking at, `router.push()` fires
// only once the screen is solid, and the run opens only once the new path
// has actually landed. Nothing of the new page is ever visible until it is
// fully covered, which is the whole point of a curtain.
//
// Because the trigger is a click and not a pathname, a reload cannot play a
// transition — which the pathname-driven version did on every refresh, since
// React's StrictMode double-invokes mount effects in development and the
// second invocation looked exactly like a navigation.
//
// Browser back/forward deliberately gets no transition. There is no click to
// intercept, so the only honest options are "flash the new page then cover
// it" (the bug above) or "go instantly". Instant is what the back button is
// for.
//
// ── Why this is not Barba.js (or three.js) ──
// Barba solves exactly this cover-then-navigate problem for multi-page apps
// by intercepting links and swapping containers itself. Here the App Router
// already owns the swap, so all that is needed from that idea is the click
// interception above — roughly twenty lines — and adopting the library would
// mean handing it the router as well. Nothing here needs WebGL either: five
// translating divs are a compositor-only animation, which a full-screen
// shader on every navigation would not be.
//
// ── Reduced motion, and not breaking navigation ──
// With `prefers-reduced-motion: reduce` no listener is installed at all, so
// links navigate natively and the run never renders. The overlay is
// `pointer-events-none` throughout and removed from the DOM between
// navigations, so it can never sit invisibly over the page swallowing
// clicks.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getLenis } from "@/components/shared/SmoothScroll";
import type { NavLink, SiteContent } from "@/lib/content";

// Five leaves off the same board, all within the brand's forest. Ordered so
// no two neighbours match and the run reads as material rather than as a
// gradient — a book-matched front is not a fade from dark to light, it is
// adjacent leaves disagreeing slightly. Five panels because it is enough for
// the weave to read as a run at desktop width and still enough at 375px for
// each panel to be a door rather than a slat.
const PANELS = ["#0A2123", "#102E2D", "#0B2422", "#173331", "#0E2928"] as const;

// The shadow gap: darker than every panel, because a reveal is a void.
const GAP = "#0B1712";

// Alternate panels are fitted from the head and from the base. -1 arrives
// from above, +1 from below; on the way out each one continues the way it
// came, which is `-side` (see the note at the top of the file).
const side = (index: number) => (index % 2 === 0 ? -1 : 1);

// If the new route has not landed by now, open anyway rather than sit closed.
// The overlay never blocks input, so this is a cosmetic backstop, not a lock.
const ROUTE_TIMEOUT_MS = 2500;

// Where a path sits in the header's own order, plus how this run should be
// labelled — reusing the exact "index into the navigation, padded to two
// digits" numbering the mobile menu already prints beside each page. Service
// detail pages (not navigation entries themselves) inherit Services' position
// and label with their own name rather than "Services", so /services/kitchens
// still sorts as forward-of-Home but reads as "Bespoke Kitchens". Anything else
// (booking, a future route) sorts past the end of the list — it always reads
// as "forward".
/**
 * Every page arrives at the top. A page sets its scroll triggers up at
 * whatever scroll it inherits, and arriving thousands of pixels down — the
 * previous page's position — fires a run of `once: true` reveals mid-refresh.
 * Each kills itself inside GSAP's refresh loop, two in a row is more than the
 * loop can step over, and it throws "Cannot read properties of undefined
 * (reading 'end')", leaving the page half set up: the home hero without its
 * pin, sections and the footer never revealed. Called while the run is
 * closed, so the jump is never seen; Lenis first, or it scrolls straight back.
 */
function toTop() {
  getLenis()?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
}

function locate(
  nav: NavLink[],
  pathname: string,
  fallbackLabel: string,
): { order: number; index: string; label: string } {
  const linkIndex = nav.findIndex((l) => l.path === pathname);
  if (linkIndex !== -1) {
    return { order: linkIndex, index: String(linkIndex + 1).padStart(2, "0"), label: nav[linkIndex].label };
  }

  const parentIndex = nav.findIndex((l) => l.pages?.some((p) => p.href === pathname));
  if (parentIndex !== -1) {
    const page = nav[parentIndex].pages?.find((p) => p.href === pathname);
    return {
      order: parentIndex,
      index: String(parentIndex + 1).padStart(2, "0"),
      label: page?.label ?? nav[parentIndex].label,
    };
  }

  return { order: nav.length, index: String(nav.length + 1).padStart(2, "0"), label: fallbackLabel };
}

export function PageTransition({
  nav,
  content,
}: {
  nav: NavLink[];
  content: SiteContent["pageTransition"];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  /** Bumped to re-close a run that is already opening — see the click handler. */
  const [run, setRun] = useState(0);
  const [plate, setPlate] = useState({ index: "00", label: "" });
  const forwardRef = useRef(true);
  /** Where this navigation is going: `path` to compare, `href` to push. */
  const targetRef = useRef<{ path: string; href: string } | null>(null);
  /** The run is fully closed and has held its beat. */
  const coveredRef = useRef(false);
  /** The new route has mounted behind the closed run. */
  const landedRef = useRef(false);
  /** Set by the animation effect; called by the pathname watcher below. */
  const openRef = useRef<() => void>(() => {});
  /** The run is opening onto the page it just covered. */
  const openingRef = useRef(false);

  // Back and Forward bypass the click handler below, so they get the same
  // reset here. The browser would not restore a useful position anyway: the
  // offset it keeps belongs to the page being left.
  useEffect(() => {
    window.addEventListener("popstate", toTop);
    return () => window.removeEventListener("popstate", toTop);
  }, []);

  // ── Take the click before <Link> does ──
  useEffect(() => {
    if (reduced) return;

    const onClick = (event: MouseEvent) => {
      // Left click, unmodified, not already handled. A modified click is the
      // reader asking for a new tab, and that must stay native.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Route handlers (Exit preview, the OG images) are not pages: the
      // browser has to request them itself for their cookies and redirects.
      if (url.pathname.startsWith("/api/")) return;
      // An anchor into the page already open ("#main", "/#home-services"):
      // that is a scroll, not a navigation, and Lenis owns it.
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();

      const to = locate(nav, url.pathname, content.fallbackLabel);
      forwardRef.current =
        to.order >= locate(nav, window.location.pathname, content.fallbackLabel).order;
      targetRef.current = { path: url.pathname, href: url.pathname + url.search + url.hash };
      landedRef.current = false;
      setPlate({ index: to.index, label: to.label });

      if (!active) {
        coveredRef.current = false;
        setActive(true);
      } else if (openingRef.current) {
        // Clicked while the run was opening onto the last page: close it
        // again from wherever the panels are. Pushing now would swap the page
        // in under half-open panels.
        coveredRef.current = false;
        setRun((n) => n + 1);
      } else if (coveredRef.current) {
        // Clicked again while the run was already closed and waiting — just
        // re-aim it. (Nothing is clickable under the overlay, but the mobile
        // menu can still be open above it.) If it is mid-close instead, the
        // close timeline pushes whatever target is current when it lands.
        toTop();
        router.push(targetRef.current.href);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [reduced, router, active, nav, content.fallbackLabel]);

  // ── Close, navigate, hold, open ──
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    const rail = railRef.current;
    const plateEl = plateRef.current;
    if (!root || !rail || !plateEl) return;

    const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", root);
    // Fitting along the wall in the direction of travel. GSAP's "start"/"end"
    // stagger origins are in DOM order, which is left to right.
    const along = { each: 0.04, from: forwardRef.current ? ("start" as const) : ("end" as const) };

    // A re-close starts from wherever the opening left the panels.
    const reclosing = openingRef.current;
    openingRef.current = false;
    if (!reclosing) {
      // 101 rather than 100: a hairline of sub-pixel rounding at the extreme
      // of a percentage translate is the difference between a clean edge and a
      // one-pixel seam of the page showing through the closed run.
      gsap.set(panels, { yPercent: (i: number) => side(i) * 101 });
      gsap.set(rail, { scaleX: 0, transformOrigin: forwardRef.current ? "left center" : "right center" });
      gsap.set(plateEl, { opacity: 0, y: 10 });
    }

    let openTl: gsap.core.Timeline | null = null;
    // The run opens only when both conditions hold: it has finished closing
    // and held its beat, *and* the new route has landed behind it. Whichever
    // happens second calls this.
    const openWhenReady = () => {
      if (openTl || !coveredRef.current || !landedRef.current) return;
      openingRef.current = true;
      openTl = gsap
        .timeline({
          onComplete: () => {
            openingRef.current = false;
            coveredRef.current = false;
            landedRef.current = false;
            setActive(false);
          },
        })
        // Both marks are fully clear before the run starts opening beneath
        // them — a label still fading while the panel carrying it slides
        // away is what makes this look like two animations instead of one
        // object.
        .to([plateEl, rail], { opacity: 0, duration: 0.14, ease: "power2.in" })
        .to(
          panels,
          { yPercent: (i: number) => side(i) * -101, duration: 0.42, ease: "power3.inOut", stagger: along },
          0.02,
        );
    };
    openRef.current = openWhenReady;

    const closeTl = gsap
      .timeline()
      .to(panels, { yPercent: 0, duration: 0.4, ease: "power3.inOut", stagger: along }, 0)
      // The rail finishes drawing exactly as the last panel lands, so it
      // reads as one continuous piece of hardware spanning a finished run
      // rather than a line drawn over doors that are still moving.
      .to(rail, { scaleX: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, 0.24)
      .to(plateEl, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, 0.42)
      // Solid screen: only now is it safe to swap the page underneath.
      .call(
        () => {
          if (!targetRef.current) return;
          toTop();
          router.push(targetRef.current.href);
        },
        undefined,
        0.56,
      )
      // A held beat before the run may open — long enough to read the plate,
      // and enough of a pause that a route arriving instantly (prefetched,
      // which is the normal case) does not make the cover look like a blink.
      .call(
        () => {
          coveredRef.current = true;
          openWhenReady();
        },
        undefined,
        0.8,
      );

    const bail = setTimeout(() => {
      landedRef.current = true;
      openWhenReady();
    }, ROUTE_TIMEOUT_MS);

    return () => {
      closeTl.kill();
      openTl?.kill();
      clearTimeout(bail);
    };
  }, [active, run, router]);

  // The new route has mounted behind the closed run.
  useEffect(() => {
    if (!active || pathname !== targetRef.current?.path) return;
    landedRef.current = true;
    openRef.current();
  }, [pathname, active]);

  if (reduced || !active) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      // No background of its own — the overlay must leave nothing behind once
      // the run has travelled off, so the shadow gap is carried by the doors
      // (as a left edge on each one) rather than painted on the wall behind
      // them. That is also how a real reveal works: it is a machined edge on
      // the panel, not a stripe on the wall.
      className="pointer-events-none fixed inset-0 z-[150] flex overflow-hidden"
    >
      {PANELS.map((tone, i) => (
        <div
          key={tone}
          data-panel
          className="h-full flex-1"
          style={{
            backgroundColor: tone,
            borderLeft: i > 0 ? `2px solid ${GAP}` : undefined,
            // Fine vertical grain, plus a soft fall of light down the door.
            // Both are near-invisible individually and together are the
            // difference between a coloured rectangle and a faced panel.
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(242,240,235,0.028) 0px, rgba(242,240,235,0.028) 1px, transparent 1px, transparent 4px)," +
              "linear-gradient(180deg, rgba(242,240,235,0.05) 0%, transparent 38%, rgba(0,0,0,0.14) 100%)",
          }}
        />
      ))}

      {/* The rail — one length crossing every door, set at handle height
          rather than centred so the composition has a short side. */}
      <div ref={railRef} className="absolute left-0 right-0 top-[58%] h-px bg-enzo-sand/50" />

      {/* The plate: sheet number, destination, firm. It sits *on* the rail
          rather than in a corner of its own — `bottom: 42%` is the rail's
          58%, so the two marks are one piece of hardware with its label
          applied, which is how a finished run is actually identified. Set in
          `bottom` rather than a translate because GSAP animates `y` here,
          and a CSS transform on the same element would fight it. */}
      <div ref={plateRef} className="absolute bottom-[42%] left-[clamp(1.25rem,4.5vw,5.5rem)] mb-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[20px] font-semibold tabular-nums leading-none text-enzo-sand">
            {plate.index}
          </span>
          <span className="text-[15px] font-medium text-enzo-cream">{plate.label}</span>
        </div>
        <p className="mt-2 font-display text-[9px] font-semibold uppercase tracking-[0.3em] text-enzo-sand/85">
          {content.imprint}
        </p>
      </div>
    </div>
  );
}
