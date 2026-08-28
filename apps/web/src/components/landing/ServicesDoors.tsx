"use client";

// Section 01 — four doors you open.
//
// Replaces the pinned horizontal rail. Two things were wrong with that: it
// asked the visitor to scroll sideways inside a page that scrolls down (and
// on desktop the pin fought the hero's own pin, so the rail bled through the
// media-wall frames), and a rail of equal cards says nothing about the
// product. This says something: the four disciplines are four door fronts,
// and opening one is how you see inside it — the same gesture the furniture
// itself asks for.
//
// Nothing here is pinned and nothing scrolls sideways. Desktop gets a row of
// vertical slats that expand in place; below `lg` the same data becomes a
// stacked accordion, because a row of vertical slats is unreadable on a
// phone. Both are driven by an explicit click, so there is no hover-only
// state and no auto-advance to fight.
import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import type { Service } from "@/lib/content";

interface ServicesDoorsProps {
  services: Service[];
}

export function ServicesDoors({ services }: ServicesDoorsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(0);

  useGSAP(sectionRef, (section, reduced) => {
    const doors = gsap.utils.toArray<HTMLElement>("[data-door]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-door-row]", section);
    const footer = section.querySelector<HTMLElement>("[data-door-footer]");

    if (reduced) {
      gsap.set([...doors, ...rows, footer].filter(Boolean), { opacity: 1, y: 0, scaleY: 1 });
      return;
    }

    // The doors themselves rise and un-squash — the reveal is the component,
    // not just its text. transformOrigin at the bottom makes them read as
    // panels being stood up rather than sliding in.
    if (doors.length) {
      gsap.from(doors, {
        opacity: 0,
        y: 44,
        scaleY: 0.9,
        transformOrigin: "50% 100%",
        duration: 0.85,
        ease: EASE.editorial,
        stagger: 0.08,
        scrollTrigger: { trigger: doors[0], start: REVEAL_START, once: true },
      });
    }
    if (rows.length) {
      gsap.from(rows, {
        opacity: 0,
        y: 26,
        duration: DUR.enter,
        ease: EASE.enter,
        stagger: 0.07,
        scrollTrigger: { trigger: rows[0], start: REVEAL_START, once: true },
      });
    }
    if (footer) {
      gsap.from(footer, {
        opacity: 0,
        y: 20,
        duration: DUR.enter,
        ease: EASE.enter,
        scrollTrigger: { trigger: footer, start: "top 92%", once: true },
      });
    }
  });

  // Left/right arrows move between doors once one has focus, which is what a
  // row of related panels should do for a keyboard user.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % services.length
        : (index - 1 + services.length) % services.length;
    setOpen(next);
    const target = sectionRef.current?.querySelectorAll<HTMLElement>("[data-door] button");
    target?.[next]?.focus();
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="services-heading"
      className="relative overflow-hidden bg-background"
    >
      {/* Seam out of the hero's near-black frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-enzo-dark/15 to-transparent"
      />

      <div className="relative mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="services-heading" className="sr-only">
          Services
        </h2>

        <SectionIntro
          layout="split"
          index="01"
          label="Services"
          datum="four disciplines"
          lines={["Everything fitted.", "Nothing off the shelf."]}
          lede="Four things, made properly — drawn, built in our workshop and fitted by us. Open a door to see what each one includes."
        />

        {/* ── Desktop: doors ── */}
        <div
          className="mt-9 hidden gap-3 lg:flex lg:h-[clamp(400px,56vh,560px)]"
          role="group"
          aria-label="Services"
        >
          {services.map((service, index) => {
            const isOpen = index === open;
            return (
              <article
                key={service.slug}
                data-door
                data-open={isOpen}
                className="group relative min-w-0 overflow-hidden rounded-[20px] bg-enzo-forest transition-[flex-grow] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ flexGrow: isOpen ? 5 : 1, flexBasis: 0 }}
              >
                <ImageWithFallback
                  src={service.image}
                  alt={service.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out"
                  style={{
                    opacity: isOpen ? 1 : 0.42,
                    transform: isOpen ? "scale(1)" : "scale(1.12)",
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{
                    background: isOpen
                      ? "linear-gradient(to top, rgba(16,26,22,0.96) 0%, rgba(16,26,22,0.86) 34%, rgba(16,26,22,0.34) 62%, rgba(16,26,22,0.12) 100%)"
                      : "linear-gradient(to top, rgba(16,26,22,0.88), rgba(16,26,22,0.62))",
                  }}
                />

                {/* The whole slat is the control. Closed, it is a door front;
                    open, the button becomes the panel's own heading link
                    target and the detail sits above it. */}
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  aria-expanded={isOpen}
                  aria-controls={`door-panel-${service.slug}`}
                  className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-enzo-sand"
                >
                  <span className="sr-only">
                    {isOpen ? `${service.title}, open` : `Open ${service.title}`}
                  </span>
                </button>

                {/* Closed state — vertical door front */}
                <div
                  aria-hidden={isOpen}
                  className="absolute inset-0 flex flex-col items-center justify-between py-7 transition-opacity duration-500"
                  style={{ opacity: isOpen ? 0 : 1, pointerEvents: "none" }}
                >
                  <span className="font-display text-[11px] font-semibold tabular-nums text-enzo-sand">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="whitespace-nowrap text-[15px] font-medium tracking-[0.02em] text-enzo-cream"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {service.title}
                  </span>
                  {/* Handle — the affordance, and the thing that moves on
                      hover, exactly like reaching for a real door. */}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-enzo-cream/30 text-enzo-cream transition-all duration-300 group-hover:border-enzo-sand group-hover:bg-enzo-sand group-hover:text-enzo-forest">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>

                {/* Open state — the room behind the door */}
                <div
                  id={`door-panel-${service.slug}`}
                  className="pointer-events-none absolute inset-0 flex flex-col justify-end p-8 transition-opacity duration-500"
                  style={{ opacity: isOpen ? 1 : 0, transitionDelay: isOpen ? "180ms" : "0ms" }}
                >
                  <span className="font-display mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-enzo-sand">
                    {String(index + 1).padStart(2, "0")} / {service.category}
                  </span>
                  <h3 className="text-[clamp(1.5rem,2.2vw,2.1rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-enzo-cream">
                    {service.title}
                  </h3>
                  <p className="mt-3 max-w-[42ch] text-[14px] leading-[1.65] text-enzo-cream/80">
                    {service.description}
                  </p>
                  <ul className="mt-5 flex max-w-[46ch] flex-wrap gap-x-5 gap-y-2">
                    {service.features.slice(0, 4).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-[12.5px] text-enzo-cream/70"
                      >
                        <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/services/${service.slug}`}
                    tabIndex={isOpen ? 0 : -1}
                    className="group/cta pointer-events-auto mt-7 inline-flex w-fit items-center gap-2.5 rounded-full bg-enzo-cream px-6 py-3 text-[13px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest"
                  >
                    Explore {service.category.toLowerCase()}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Mobile: accordion ── */}
        <div className="mt-10 lg:hidden">
          {services.map((service, index) => {
            const isOpen = index === open;
            return (
              <div
                key={service.slug}
                data-door-row
                data-open={isOpen}
                className="border-t border-border/70 last:border-b"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                  aria-controls={`door-sheet-${service.slug}`}
                  className="flex w-full items-center gap-4 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="font-display text-[11px] font-semibold tabular-nums text-enzo-forest-light">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[1.15rem] font-semibold tracking-[-0.02em] text-primary">
                    {service.title}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors duration-300 data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground" data-on={isOpen}>
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>

                <div
                  id={`door-sheet-${service.slug}`}
                  className="grid transition-[grid-template-rows] duration-500 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="pb-6">
                      <div className="overflow-hidden rounded-[16px]">
                        <ImageWithFallback
                          src={service.image}
                          alt={service.title}
                          loading="lazy"
                          className="aspect-[16/10] w-full object-cover"
                        />
                      </div>
                      <p className="mt-4 text-[14px] leading-[1.65] text-foreground/75">
                        {service.description}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {service.features.slice(0, 3).map((feature) => (
                          <li
                            key={feature}
                            className="flex items-center gap-2.5 text-[13px] text-foreground/75"
                          >
                            <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={`/services/${service.slug}`}
                        tabIndex={isOpen ? 0 : -1}
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-[13px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Explore {service.category.toLowerCase()}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          data-door-footer
          className="mt-10 flex flex-wrap items-center justify-between gap-4 lg:mt-12"
        >
          <p className="text-[13px] text-foreground/70">
            Not sure which you need? We work it out on the first visit.
          </p>
          <Link
            href="/services"
            className="group/all inline-flex items-center gap-2 border-b border-primary/25 pb-1 text-[13px] font-medium text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
          >
            All services
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover/all:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
