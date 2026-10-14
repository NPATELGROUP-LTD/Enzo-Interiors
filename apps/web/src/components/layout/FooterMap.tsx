"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import { setConsent, useConsent } from "@/lib/consent";
import type { Company, SiteContent } from "@/lib/content";
import { cn } from "@/lib/utils";

// The actual "Enzo Interiors" Google Business listing embed (provided
// directly), not a generic city-level search — this pins the real premises
// rather than just centering on Leicester. "Open in Maps" links out to a
// name search rather than the raw CID, since Google's search-by-place URL
// param expects a `ChIJ…` place ID, which this listing's CID (a different
// ID format) doesn't directly convert to — a plain business-name search
// reliably lands on the same listing without needing that conversion.
//
// Both URLs, the frame's title and the chip's labels come from the company
// record in src/data/company.json, so the address the site points at is
// stated once.
//
// The embed sets Google's cookies as soon as it loads, so it loads only with
// "functional" consent (lib/consent.ts). Until then the same box holds a
// note and a button; pressing it is the consent, recorded like any other.

// `compact` drives the desktop single-screen panel's small thumbnail
// (~130px wide) — the default chip's padding/text would overrun a box that
// small, so compact swaps it for an icon-only pin.
export function FooterMap({
  map,
  labels,
  compact = false,
}: {
  map: Company["map"];
  labels: SiteContent["footer"]["mapConsent"];
  compact?: boolean;
}) {
  const consent = useConsent();
  const allowed = consent?.functional === true;
  const size = compact ? "aspect-square" : "aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/6]";
  return (
    <div className="group relative overflow-hidden rounded-2xl border-2 border-enzo-cream/20 bg-black/15 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] transition-colors duration-300 hover:border-enzo-cream/30">
      {/* Kept in its natural colour rather than faked into grayscale/dark
          mode — the invert+hue-rotate trick used previously left it reading
          as flat black-and-white, which lost the actual useful information
          (roads, green space, water) a map is for. A plain colour map inside
          a dark card is a completely normal, legible pairing; only a slight
          brightness/contrast trim so it doesn't sit as a jarringly bright
          rectangle against the dark surface around it. The non-compact
          aspect widens progressively (not a fixed px height) since this now
          renders as a full-width banner row rather than a narrow column —
          a tall 5:4 ratio at full container width would have made it
          enormous. */}
      {allowed ? (
        <iframe
          title={map.title}
          src={map.embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className={cn(
            "w-full brightness-[0.92] contrast-[1.03] saturate-[1.05] transition-[filter] duration-500 group-hover:brightness-100",
            size,
          )}
        />
      ) : (
        <div
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 px-6 pb-14 text-center",
            size,
          )}
        >
          <MapPin className="h-5 w-5 text-enzo-sand" aria-hidden="true" />
          {!compact && (
            <p className="max-w-[44ch] text-[12.5px] leading-[1.6] text-enzo-cream/75">{labels.note}</p>
          )}
          <button
            type="button"
            onClick={() =>
              setConsent({
                functional: true,
                analytics: consent?.analytics ?? false,
                marketing: consent?.marketing ?? false,
              })
            }
            className="min-h-11 rounded-full border border-enzo-cream/30 px-5 text-[12.5px] font-medium text-enzo-cream transition-colors duration-300 hover:border-enzo-cream hover:bg-enzo-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
          >
            {labels.buttonLabel}
          </button>
        </div>
      )}
      {/* Scrim so the chip stays legible over whatever's directly under it
          on the map, rather than relying on the chip's own bg alone. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent"
      />
      <a
        href={map.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={map.linkAriaLabel}
        className={cn(
          "absolute flex items-center gap-1.5 rounded-lg bg-enzo-sand font-semibold text-enzo-forest shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:brightness-110",
          // min-h-11 on the full version: a 32px chip floating over a map is
          // the one control on this panel a thumb has to find, and it sits
          // right on the panel's own edge where a miss lands on nothing.
          compact ? "bottom-1.5 left-1.5 p-1.5" : "bottom-3.5 left-3.5 min-h-11 px-4 text-[12px]",
        )}
      >
        {!compact && map.linkLabel}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
