"use client";

// Section 06 — the closing beat, merging what used to be two sections.
//
// The old page ended with a booking slab and *then* a social grid, which
// meant the last thing before the footer was a row of thumbnails rather
// than an ask. Here the recent-installs strip and the invitation are one
// section: the work drifts past overhead, the ask sits underneath it, and
// the ground darkens into the footer.
//
// The strip is coupled to scroll velocity — flick the page and the work
// runs with you, stop and it settles back to its own pace. That is the
// only place on the page where scrolling changes the *speed* of something
// rather than its position, which is what keeps it feeling alive without
// adding another parallax.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { InstagramIcon } from "@/components/shared/icons";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import type { PortfolioItem } from "@/lib/content";

const INSTAGRAM_URL = "https://instagram.com/enzo.interiors";
const MARQUEE_SECONDS = 48;

interface StudioInviteProps {
  items: PortfolioItem[];
}

export function StudioInvite({ items }: StudioInviteProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    if (reduced) return;

    const track = section.querySelector<HTMLElement>("[data-marquee-track]");
    if (!track) return;

    // The track holds the run of images twice, so travelling exactly half
    // its width lands on a frame identical to the start — the loop point
    // is invisible without measuring anything.
    const loop = gsap.to(track, {
      xPercent: -50,
      duration: MARQUEE_SECONDS,
      ease: "none",
      repeat: -1,
    });

    let settleTimer: number | undefined;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        const direction = velocity < 0 ? -1 : 1;
        const boost = gsap.utils.clamp(1, 5, 1 + Math.abs(velocity) / 700);
        gsap.to(loop, { timeScale: boost * direction, duration: 0.35, overwrite: true });
        gsap.to(track, {
          skewX: gsap.utils.clamp(-2, 2, velocity / -1400),
          duration: 0.4,
          overwrite: "auto",
        });

        // ScrollTrigger only reports while the page is moving, so the
        // return to resting speed has to be scheduled rather than driven.
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          gsap.to(loop, { timeScale: 1, duration: 1.2, overwrite: true });
          gsap.to(track, { skewX: 0, duration: 0.6, overwrite: "auto" });
        }, 180);
      },
    });

    return () => {
      window.clearTimeout(settleTimer);
      trigger.kill();
      loop.kill();
    };
  });

  // Two passes of the same images: one visible run plus the copy that
  // replaces it as the first scrolls out.
  const strip = [...items, ...items];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="invite-heading"
      className="relative overflow-hidden bg-enzo-dark"
    >
      <div className="pt-20 md:pt-24">
        <div className="mx-auto mb-8 flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 md:px-12">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-sage">
            Recent installs
          </span>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group/ig inline-flex items-center gap-2 text-[13px] text-enzo-cream/60 transition-colors duration-300 hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
          >
            <InstagramIcon
              size={14}
              className="transition-transform duration-300 group-hover/ig:-rotate-6"
            />
            @enzo.interiors
          </a>
        </div>

        <div
          aria-hidden="true"
          className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div data-marquee-track className="flex w-max gap-4 will-change-transform">
            {strip.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="group/tile relative h-[clamp(150px,19vw,230px)] w-[clamp(210px,26vw,330px)] shrink-0 overflow-hidden rounded-[16px]"
              >
                <ImageWithFallback
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover opacity-75 transition-all duration-500 ease-out group-hover/tile:scale-[1.04] group-hover/tile:opacity-100"
                />
                <span className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-enzo-cream opacity-0 transition-opacity duration-500 group-hover/tile:opacity-100">
                  <span>{item.location}</span>
                  <span className="font-display tabular-nums">{item.year}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
        <h2 id="invite-heading" className="sr-only">
          Book a consultation
        </h2>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-end lg:gap-20">
          <div>
            <SectionIntro
              tone="dark"
              index="06"
              label="Next"
              datum="free, no obligation"
              lines={["Let us measure", "your space."]}
              lede="An hour at your kitchen table, a tape measure and a few photographs. You get a drawing and a fixed price; we get to see the room properly. Nothing else happens until you say so."
            />
            <MagneticButton href="/booking" className="-ml-5 mt-6">
              Book a free consultation
            </MagneticButton>
          </div>

          <div className="border-t border-enzo-cream/15 pt-6 lg:pb-4">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-cream/60">
              Rather not book online
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <a
                href="tel:+447777333052"
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="text-[15px]">07777 333052</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/60 transition-colors duration-300 group-hover/link:text-enzo-sage">
                  Call
                </span>
              </a>
              <a
                href="mailto:hello@enzointeriors.co.uk"
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="truncate text-[15px]">hello@enzointeriors.co.uk</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/60 transition-colors duration-300 group-hover/link:text-enzo-sage">
                  Email
                </span>
              </a>
              <p className="text-[12.5px] leading-[1.65] text-enzo-cream/60">
                Send photos of the room and rough measurements and we will come back with a
                ballpark before we visit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seam into the footer's darker ground. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-enzo-footer-dark"
      />
    </section>
  );
}
