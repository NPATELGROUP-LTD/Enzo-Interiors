import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// The actual "Enzo Interiors" Google Business listing embed (provided
// directly), not a generic city-level search — this pins the real premises
// rather than just centering on Leicester. "Open in Maps" links out to a
// name search rather than the raw CID, since Google's search-by-place URL
// param expects a `ChIJ…` place ID, which this listing's CID (a different
// ID format) doesn't directly convert to — a plain business-name search
// reliably lands on the same listing without needing that conversion.
const MAPS_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2420.831822724726!2d-1.1107692229734167!3d52.64495137209415!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4877614e3feb8465%3A0x3de3e5b41870cbd7!2sEnzo%20Interiors!5e0!3m2!1sen!2suk!4v1787175154920!5m2!1sen!2suk";
const MAPS_LINK = "https://www.google.com/maps/search/?api=1&query=Enzo+Interiors+Leicester";

// `compact` drives the desktop single-screen panel's small thumbnail
// (~130px wide) — the default chip's padding/text would overrun a box that
// small, so compact swaps it for an icon-only pin.
export function FooterMap({ compact = false }: { compact?: boolean }) {
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
      <iframe
        title="Enzo Interiors — Leicester"
        src={MAPS_EMBED_SRC}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={cn(
          "w-full brightness-[0.92] contrast-[1.03] saturate-[1.05] transition-[filter] duration-500 group-hover:brightness-100",
          compact ? "aspect-square" : "aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/6]",
        )}
      />
      {/* Scrim so the chip stays legible over whatever's directly under it
          on the map, rather than relying on the chip's own bg alone. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent"
      />
      <a
        href={MAPS_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Enzo Interiors service area in Google Maps"
        data-cursor="view"
        className={cn(
          "absolute flex items-center gap-1.5 rounded-lg bg-enzo-sand font-semibold text-enzo-forest shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-[filter,transform] duration-200 hover:-translate-y-0.5 hover:brightness-110",
          // min-h-11 on the full version: a 32px chip floating over a map is
          // the one control on this panel a thumb has to find, and it sits
          // right on the panel's own edge where a miss lands on nothing.
          compact ? "bottom-1.5 left-1.5 p-1.5" : "bottom-3.5 left-3.5 min-h-11 px-4 text-[12px]",
        )}
      >
        {!compact && "View On Google Maps"}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
