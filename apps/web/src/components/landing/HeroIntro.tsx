import Link from "next/link";
import { TextRotate } from "@/components/shared/TextRotate";
import { Button } from "@/components/ui/Button";

// Persistent headline + CTA overlay shared by the scrubbing Hero (desktop)
// and HeroStatic (mobile/reduced-motion) — the marketing message that stays
// constant regardless of which visual treatment renders behind it.
export function HeroIntro() {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="text-[11px] uppercase tracking-[0.3em] text-enzo-sage md:text-[13px]">
        Leicestershire&apos;s Bespoke Interior Specialists
      </span>
      <div
        className="flex flex-wrap items-center justify-center gap-2 font-serif text-enzo-cream"
        style={{ fontSize: "clamp(2.8rem, 7vw, 6rem)", lineHeight: 1.05, fontWeight: 400 }}
      >
        <span>Crafting Bespoke </span>
        <TextRotate
          texts={["Kitchens", "Bedrooms", "Wardrobes", "Media Walls", "Spaces"]}
          mainClassName="justify-center overflow-hidden rounded-lg bg-enzo-forest/60 px-2 py-1 text-enzo-cream backdrop-blur-sm sm:px-3 sm:py-1.5"
          staggerFrom="last"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-120%" }}
          staggerDuration={0.025}
          splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          rotationInterval={2000}
        />
      </div>
      <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Button asChild size="md">
          <Link href="/booking">Book a Free Consultation</Link>
        </Button>
        <Button asChild variant="secondary" size="md">
          <Link href="/portfolio">View Our Work</Link>
        </Button>
      </div>
    </div>
  );
}
