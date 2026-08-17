import Image from "next/image";
import { HeroIntro } from "./HeroIntro";

// Mobile / prefers-reduced-motion fallback for Hero — a single static image
// (the Bedroom sequence's finished last frame — the end of the 3-room v3
// story) with the same headline/CTA overlay, no canvas, no frame preloading,
// no scroll trapping.
export function HeroStatic() {
  return (
    <section className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-enzo-dark px-6">
      <Image
        src="/frames/hero/bedroom/frame_0144.webp"
        alt="A finished bespoke bedroom by Enzo Interiors"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/50"
      />
      <div className="relative z-[1]">
        <HeroIntro />
      </div>
    </section>
  );
}
