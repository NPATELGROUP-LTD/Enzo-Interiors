"use client";

// /services/[category] §A1 — the cover.
//
// A hard split down the middle of the viewport: everything you read on the
// left, the room itself on the right, running edge to edge and top to
// bottom with no card, no rounding, no corner ticks and no gradient over
// it. The photograph is the only image on the fold, so it gets the whole
// half and none of the decoration.
//
// Deliberately a different shape from the /services fold, which is
// type-left / *drawing*-right with a list underneath. Same family, not the
// same page twice.
//
// Removed and not to be re-tried: a radial "light" behind the type (reads
// as a gradient artefact on near-black), a ruled background grid, and the
// three-cell bordered fact box — three facts separated by hairlines say the
// same thing without drawing a table on the fold.
//
// The facts are read off the record rather than authored, so any service
// the client publishes gets a complete cover.
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import { getServiceMetrics } from "@/lib/service-metrics";
import type { ServiceDetail } from "@/lib/content";

interface ServiceCoverSheetProps {
  service: ServiceDetail;
  /** Position in the published set, e.g. 2 of 4 — the sheet's own number. */
  position: { index: number; total: number };
  /** The quote-modal trigger, injected so this file stays modal-agnostic. */
  quoteCta: ReactNode;
  id: string;
}

export function ServiceCoverSheet({
  service,
  position,
  quoteCta,
  id,
}: ServiceCoverSheetProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const metrics = getServiceMetrics(service);

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-cover-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-cover-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-cover-body]", section);
    const plate = section.querySelector<HTMLElement>("[data-cover-plate]");
    const photo = section.querySelector<HTMLElement>("[data-cover-photo]");

    if (reduced) {
      gsap.set([...meta, ...body].filter(Boolean), { opacity: 1, y: 0 });
      gsap.set(lines, { yPercent: 0 });
      if (plate) gsap.set(plate, { clipPath: "inset(0 0 0 0)" });
      if (photo) gsap.set(photo, { scale: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.06,
      )
      // The half opens from its own outer edge inward, so the photograph
      // arrives as a panel sliding into place rather than fading up.
      .fromTo(
        plate,
        { clipPath: "inset(0 0 0 100%)" },
        { clipPath: "inset(0 0 0 0%)", duration: 1.15, ease: EASE.editorial },
        0.14,
      )
      .fromTo(photo, { scale: 1.14 }, { scale: 1, duration: 1.5, ease: EASE.editorial }, 0.14)
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.46);

    // Slow drift as the fold leaves, so the split has depth without
    // anything being pinned.
    if (photo) {
      gsap.to(photo, {
        yPercent: 7,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
      });
    }

    return () => {
      tl.kill();
    };
  });

  const facts = [
    { label: "Lead time", value: metrics.timeline },
    { label: "Survey", value: "Free, at home" },
    { label: "Guarantee", value: "5 years" },
  ];

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-cover-heading"
      className="relative bg-enzo-dark text-enzo-cream"
    >
      <div className="grid min-h-[100svh] lg:grid-cols-2">
        {/* ── Photograph ──
            Ordered first on a phone: the navbar floats over it and it is
            the fastest way to say which room this page is about. On lg it
            moves to the right half and runs the full height of the fold. */}
        <div
          data-cover-plate
          className="relative order-1 min-h-[42svh] overflow-hidden bg-enzo-forest lg:order-2 lg:min-h-0"
          style={{ clipPath: "inset(0 0 0 100%)" }}
        >
          <ImageWithFallback
            src={service.image}
            alt={service.title}
            data-cover-photo
            className="absolute inset-0 h-full w-full scale-110 object-cover will-change-transform"
          />
        </div>

        {/* ── Cover block ── */}
        <div
          className="order-2 flex flex-col justify-center px-5 pb-14 pt-12 sm:px-6 md:px-12 lg:order-1 lg:py-24 lg:pl-[max(3rem,calc((100vw-1500px)/2+3rem))] lg:pr-14"
        >
          <nav
            data-cover-meta
            aria-label="Breadcrumb"
            className="text-[11px] uppercase tracking-[0.22em] text-enzo-cream/40 opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            <Link href="/services" className="transition-colors hover:text-enzo-sand">
              Services
            </Link>
            <span className="px-2 text-enzo-cream/20">/</span>
            <span className="text-enzo-sand">{service.category}</span>
            <span className="px-2 text-enzo-cream/20">·</span>
            <span className="font-display tabular-nums">
              {String(position.index + 1).padStart(2, "0")}/
              {String(position.total).padStart(2, "0")}
            </span>
          </nav>

          <h1
            id="service-cover-heading"
            className="mt-7 font-title font-semibold leading-[0.96] tracking-[-0.045em]"
            style={{ fontSize: "clamp(2.4rem, 4.6vw, 4.2rem)" }}
          >
            {/* Split on words so a long title the client invents still
                masks up line by line rather than as one block. */}
            {service.title.split(" ").map((word) => (
              <span key={word} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                <span
                  data-cover-line
                  className="block"
                  style={{ transform: "translateY(100%)" }}
                >
                  {word}
                </span>
              </span>
            ))}
          </h1>

          <p
            data-cover-body
            className="mt-6 max-w-[42ch] text-[15px] leading-[1.7] text-enzo-cream/60 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {service.heroDesc}
          </p>

          <div
            data-cover-body
            className="mt-9 flex flex-wrap items-center gap-3 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {quoteCta}
            <Link
              href={`/booking?service=${service.slug}`}
              className="group inline-flex items-center gap-2.5 rounded-full border border-enzo-cream/20 px-7 py-3.5 text-[14px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
            >
              Book a consultation
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Three facts on one hairline. No boxes — a bordered grid here
              was drawing a table on the cover. */}
          <dl
            data-cover-body
            className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-enzo-cream/12 pt-6 opacity-0"
            style={{ transform: "translateY(14px)" }}
          >
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[14px] tracking-[-0.01em] text-enzo-cream/85">
                  {fact.value}
                </dd>
              </div>
            ))}
            {metrics.fromPriceLabel && (
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.22em] text-enzo-cream/35">
                  From
                </dt>
                <dd className="mt-1.5 text-[14px] tabular-nums tracking-[-0.01em] text-enzo-sand">
                  {metrics.fromPriceLabel}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
