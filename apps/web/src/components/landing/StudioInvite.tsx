"use client";

// Section 06 — the closing beat, merging what used to be two sections.
//
// The old page ended with a booking slab and *then* a social grid, which meant
// the last thing before the footer was a row of thumbnails rather than an ask.
// Here the recent-installs strip and the invitation are one section: the work
// drifts past overhead, the ask sits underneath it, and the ground darkens
// into the footer.
//
// Two rows now, running against each other. One row reads as a slideshow; two
// counter-moving rows read as a wall of work going past, and the opposition is
// what makes the velocity coupling legible — flick the page and both rows
// visibly pull apart, stop and they settle back to their own pace. This is
// the only place on the page where scrolling changes the *speed* of something
// rather than its position.
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { InstagramIcon } from "@/components/shared/icons";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

const INSTAGRAM_URL = "https://instagram.com/enzo.interiors";
const ROW_SECONDS = [52, 64];

interface StudioInviteProps {
  items: PortfolioItem[];
}

export function StudioInvite({ items }: StudioInviteProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    if (reduced) return;

    const tracks = gsap.utils.toArray<HTMLElement>("[data-marquee-track]", section);
    if (!tracks.length) return;

    // Each track holds its run of images twice, so travelling exactly half its
    // width lands on a frame identical to the start — the loop point is
    // invisible without measuring anything.
    const loops = tracks.map((track, index) => {
      const reverse = track.dataset.reverse === "true";
      return gsap.fromTo(
        track,
        { xPercent: reverse ? -50 : 0 },
        {
          xPercent: reverse ? 0 : -50,
          duration: ROW_SECONDS[index % ROW_SECONDS.length],
          ease: "none",
          repeat: -1,
        },
      );
    });

    let settleTimer: number | undefined;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        // Speed responds to scroll velocity, but direction never does — each
        // row always runs its own way. Letting scroll-up flip the loop's
        // timeScale negative used to visibly reverse the row, and a
        // repeat:-1 tween running backwards doesn't wrap its loop point
        // cleanly, which is what produced the blank gap and slow catch-up
        // at the end of each cycle.
        const velocity = self.getVelocity();
        const boost = gsap.utils.clamp(1, 5, 1 + Math.abs(velocity) / 700);
        loops.forEach((loop) =>
          gsap.to(loop, { timeScale: boost, duration: 0.35, overwrite: true }),
        );
        tracks.forEach((track) =>
          gsap.to(track, {
            skewX: gsap.utils.clamp(-2.5, 2.5, velocity / -1200),
            duration: 0.4,
            overwrite: "auto",
          }),
        );

        // ScrollTrigger only reports while the page is moving, so the return
        // to resting speed has to be scheduled rather than driven.
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          loops.forEach((loop) =>
            gsap.to(loop, { timeScale: 1, duration: 1.2, overwrite: true }),
          );
          tracks.forEach((track) =>
            gsap.to(track, { skewX: 0, duration: 0.6, overwrite: "auto" }),
          );
        }, 180);
      },
    });

    const contact = section.querySelector<HTMLElement>("[data-invite-contact]");
    if (contact) {
      gsap.from(contact, {
        opacity: 0,
        y: 30,
        duration: DUR.enter,
        ease: EASE.enter,
        scrollTrigger: { trigger: contact, start: "top 88%", once: true },
      });
    }

    return () => {
      window.clearTimeout(settleTimer);
      trigger.kill();
      loops.forEach((loop) => loop.kill());
    };
  });

  // Row A takes the first half of the work, row B the second, so the two rows
  // are never showing the same photograph side by side.
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="invite-heading"
      className="relative overflow-hidden bg-enzo-dark"
    >
      <div className="pt-16 md:pt-24">
        <div className="mx-auto mb-7 flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 sm:px-6 md:px-12">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-sage">
            Recent installs
          </span>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group/ig inline-flex items-center gap-2.5 rounded-full border border-enzo-cream/20 px-4 py-2 text-[13px] text-enzo-cream/80 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
          >
            <InstagramIcon
              size={14}
              className="transition-transform duration-300 group-hover/ig:-rotate-12"
            />
            @enzo.interiors
          </a>
        </div>

        <div
          aria-hidden="true"
          className="flex flex-col gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)] md:gap-4"
        >
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              data-marquee-track
              data-reverse={rowIndex === 1}
              className="flex w-max gap-3 will-change-transform md:gap-4"
            >
              {[...row, ...row].map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="group/tile relative h-[clamp(130px,17vw,215px)] w-[clamp(190px,24vw,310px)] shrink-0 overflow-hidden rounded-[14px]"
                >
                  {/* Eager, not lazy: every tile here is duplicated into an
                      infinitely-looping row, so it's destined to scroll into
                      view repeatedly regardless of the visitor's actual
                      scroll position. Lazy-loading it meant the browser only
                      started fetching once the loop's second copy neared the
                      viewport, which is exactly the gap in the marquee the
                      loop point should be — the empty tile and the long
                      stall were the fetch, not a rendering bug. */}
                  <ImageWithFallback
                    src={item.image}
                    alt=""
                    loading="eager"
                    className="h-full w-full object-cover opacity-70 transition-all duration-500 ease-out group-hover/tile:scale-[1.06] group-hover/tile:opacity-100"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-enzo-dark/80 to-transparent opacity-0 transition-opacity duration-500 group-hover/tile:opacity-100" />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-1 items-center justify-between text-[10px] uppercase tracking-[0.2em] text-enzo-cream opacity-0 transition-all duration-500 group-hover/tile:translate-y-0 group-hover/tile:opacity-100">
                    <span>{item.location}</span>
                    <span className="font-display tabular-nums">{item.year}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="invite-heading" className="sr-only">
          Book a consultation
        </h2>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-end lg:gap-20">
          <div>
            <SectionIntro
              tone="dark"
              index="06"
              label="Next"
              datum="free, no obligation"
              lines={["Let us measure", "your space."]}
              lede="An hour at your kitchen table, a tape measure and a few photographs. You get a drawing and a fixed price. Nothing else happens until you say so."
            />
            <MagneticButton href="/booking" className="-ml-5 mt-5">
              Book Consultation
            </MagneticButton>
          </div>

          <div data-invite-contact className="border-t border-enzo-cream/15 pt-6 lg:pb-4">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-cream/60">
              Rather not book online
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <a
                href="tel:+447777333052"
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="text-[15px]">07777 333052</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/60 transition-colors duration-300 group-hover/link:text-enzo-sand">
                  Call
                </span>
              </a>
              <a
                href="mailto:hello@enzointeriors.co.uk"
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="truncate text-[15px]">hello@enzointeriors.co.uk</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/60 transition-colors duration-300 group-hover/link:text-enzo-sand">
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
