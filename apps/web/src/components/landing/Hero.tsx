"use client";

// Chooses the full scroll-scrubbed frame sequence on large screens, or the
// purpose-built static hero on anything smaller — a genuine component swap (no
// canvas mount, no 144-frame preload) rather than a CSS-only reflow.
//
// The threshold is 1024px, not 768px: a tablet has neither the bandwidth
// budget for 432 frames nor the pointer for a scrubbed sequence, so it gets
// the static hero along with phones. Below that width the frame sequence never
// mounts at all.
//
// This tracks the media query live, so dragging a desktop window narrow really
// does swap to the mobile hero. That only works because HeroSequence pins an
// inner element rather than the <section>: a pinned <section> is re-parented
// into GSAP's `.pin-spacer`, and React then unmounts a node that has been
// moved out from under it.
import { useState, useSyncExternalStore } from "react";
import type { HeroRoomContent, HomeContent, MediaItem } from "@/lib/content";
import { HERO_SEEN_KEY, HeroSequence, type HeroSequenceImages } from "./HeroSequence";
import { HeroCtaStatic } from "./HeroCtaStatic";
import { HeroStatic } from "./HeroStatic";

type HeroVariant = "sequence" | "cta" | "static";

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const reduced = window.matchMedia(REDUCED_QUERY);
  desktop.addEventListener("change", onChange);
  reduced.addEventListener("change", onChange);
  return () => {
    desktop.removeEventListener("change", onChange);
    reduced.removeEventListener("change", onChange);
  };
}

/** Returns a primitive, so it is safe for React to call on every render. */
function readVariant(): HeroVariant {
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  const reduced = window.matchMedia(REDUCED_QUERY).matches;
  return desktop ? (reduced ? "cta" : "sequence") : "static";
}

/** Has this browser already been through the intro? Read once per page view, so reaching the CTA does not remove the hero from under the visitor mid-scroll. */
function readSeen(): boolean {
  try {
    return window.localStorage.getItem(HERO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Both variants' copy and images arrive as props rather than being looked up
// here: this component is a client component that decides at runtime which
// hero to mount, so it cannot fetch, and resolving the media ids on the server
// keeps the media table out of the browser bundle.
export function Hero({
  hero,
  heroStatic,
  rooms,
  images,
  staticImages,
}: {
  hero: HomeContent["hero"];
  heroStatic: HomeContent["heroStatic"];
  rooms: HeroRoomContent[];
  images: HeroSequenceImages;
  staticImages: MediaItem[];
}) {
  // Server and first client render both return null, so the markup matches and
  // a neutral placeholder paints for one frame rather than the wrong variant's
  // real content flashing before it is replaced.
  const variant = useSyncExternalStore<HeroVariant | null>(subscribe, readVariant, () => null);
  const [seen] = useState(() => typeof window !== "undefined" && readSeen());

  if (!variant) {
    return <div className="hero-placeholder h-screen w-full bg-enzo-dark" />;
  }

  if (variant === "sequence" && !seen) {
    return <HeroSequence content={hero} rooms={rooms} images={images} />;
  }
  // Seen the intro already (or reduced motion): the 432 frames are skipped and the page opens on the intro's closing scene, still.
  if (variant !== "static") {
    return <HeroCtaStatic cta={hero.cta} card={images.ctaCard} showcase={images.ctaShowcase} />;
  }
  return <HeroStatic content={heroStatic} images={staticImages} />;
}
