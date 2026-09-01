"use client";

// /services §02 — where each discipline starts.
//
// This replaces a specification matrix: services as columns, attributes as
// rows, bars in the cells. It was accurate and nobody wanted to read it. A
// comparison table asks the visitor to do the comparing; the only question
// they actually arrived with is "roughly what does each of these cost", and
// a table answers that slowly.
//
// So: one axis, four marks. Every discipline is plotted at its real
// starting price on a shared money scale, which answers the question in a
// single glance and — unlike a table — makes the *relationships* visible.
// You can see that a media wall starts at a third of a kitchen without
// reading a number.
//
// Ticks and the axis maximum are derived from the data, so the scale
// re-fits itself around whatever the client publishes: a new £25k service
// simply extends the axis and everything else re-plots.
//
// Below md the axis turns vertical — a horizontal money scale on a 375px
// screen puts four labels in about 40px of usable width.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getServiceMetrics } from "@/lib/service-metrics";
import type { ServiceDetail } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** Where the scale ends when everything published fits under it. */
const AXIS_PREFERRED_MAX = 5000;

/** Short axis labels — "£5k" reads better on a scale than "£5,000". */
function shortMoney(value: number): string {
  return value >= 1000 ? `£${Math.round(value / 100) / 10}k` : `£${value}`;
}

interface Plot {
  service: ServiceDetail;
  price: number;
  label: string;
  timeline: string;
  /** 0–1 position along the axis. */
  t: number;
}

interface IndexPricingScaleProps {
  services: ServiceDetail[];
}

export function IndexPricingScale({ services }: IndexPricingScaleProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const { plots, ticks, unpriced } = useMemo(() => {
    const priced = services
      .map((service) => ({ service, metrics: getServiceMetrics(service) }))
      .filter((entry) => entry.metrics.fromPriceValue !== null);

    const max = Math.max(0, ...priced.map((e) => e.metrics.fromPriceValue ?? 0));
    // The scale tops out at £5k. Everything currently published starts
    // below that, and a £6k axis left the dearest service marked two thirds
    // of the way along with a third of the rule empty — which reads as
    // "there is more above this" when there isn't.
    //
    // Not a hard cap: if the client ever publishes something dearer, the
    // axis extends to fit it rather than plotting it off the end, because a
    // scale that silently clips a value is worse than a longer scale.
    const step = max > 12000 ? 5000 : max > 5000 ? 2500 : 1000;
    const axisMax =
      max <= AXIS_PREFERRED_MAX
        ? AXIS_PREFERRED_MAX
        : Math.max(step, Math.ceil((max * 1.1) / step) * step);

    const tickValues: number[] = [];
    for (let value = 0; value <= axisMax; value += step) tickValues.push(value);

    return {
      axisMax,
      ticks: tickValues,
      plots: priced
        .map<Plot>(({ service, metrics }) => ({
          service,
          price: metrics.fromPriceValue as number,
          label: metrics.fromPriceLabel as string,
          timeline: metrics.timeline,
          t: (metrics.fromPriceValue as number) / axisMax,
        }))
        .sort((a, b) => a.price - b.price),
      unpriced: services.length - priced.length,
    };
  }, [services]);

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const axis = section.querySelector<HTMLElement>("[data-scale-axis]");
      const tickEls = gsap.utils.toArray<HTMLElement>("[data-scale-tick]", section);
      const marks = gsap.utils.toArray<HTMLElement>("[data-scale-mark]", section);
      const counters = gsap.utils.toArray<HTMLElement>("[data-count-to]", section);

      if (reduced) {
        if (axis) gsap.set(axis, { scaleX: 1, scaleY: 1 });
        gsap.set([...tickEls, ...marks], { opacity: 1, y: 0, x: 0 });
        counters.forEach((el) => {
          el.textContent = el.dataset.countDisplay ?? el.textContent;
        });
        return;
      }

      const tl = gsap.timeline({ paused: true });

      // The rule is drawn first and the marks land on it afterwards, which
      // is the order you would actually set a scale out.
      tl.to(axis, { scaleX: 1, scaleY: 1, duration: 1, ease: EASE.editorial })
        .to(
          tickEls,
          { opacity: 1, duration: 0.4, ease: EASE.enter, stagger: 0.04 },
          0.25,
        )
        .to(
          marks,
          { opacity: 1, y: 0, duration: 0.7, ease: EASE.editorial, stagger: 0.09 },
          0.4,
        );

      counters.forEach((el, i) => {
        const to = Number(el.dataset.countTo);
        if (!Number.isFinite(to)) return;
        const proxy = { value: 0 };
        tl.to(
          proxy,
          {
            value: to,
            duration: 0.8,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = GBP.format(Math.round(proxy.value));
            },
          },
          0.45 + i * 0.09,
        );
      });

      ScrollTrigger.create({
        trigger: section,
        start: REVEAL_START,
        once: true,
        animation: tl,
      });

      return () => {
        tl.kill();
      };
    },
    { deps: [plots] },
  );

  if (!plots.length) return null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="services-pricing-heading"
      className="relative bg-background"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="services-pricing-heading" className="sr-only">
          Starting prices
        </h2>

        <SectionIntro
          layout="split"
          index="02"
          label="Scale"
          datum={`${plots.length} plotted`}
          lines={["Where each one", "starts."]}
          lede="Entry specification, typical room, everything included. Plotted on one scale so you can see how the disciplines actually compare before you talk to anyone."
        />

        {/* ── md and up: horizontal scale ── */}
        <div className="mt-20 hidden md:block">
          <div className="relative h-[19rem]">
            {/* The rule, with its ticks. */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              <span
                data-scale-axis
                className="block h-px origin-left bg-foreground/25"
                style={{ transform: "scaleX(0)" }}
              />
              {ticks.map((value, i) => (
                <span
                  key={value}
                  data-scale-tick
                  className="absolute top-0 opacity-0"
                  style={{ left: `${(i / (ticks.length - 1)) * 100}%` }}
                >
                  <span className="block h-2 w-px -translate-x-px bg-foreground/25" />
                  <span className="mt-2 block -translate-x-1/2 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                    {shortMoney(value)}
                  </span>
                </span>
              ))}
            </div>

            {/* Marks. Alternating above/below the rule so labels never
                collide, however tightly two services are priced.

                The below-rule labels clear the axis figures by a fixed
                band rather than sitting just under the line: at 0.75rem a
                service name landed straight on top of whichever £-figure
                it happened to be near ("Media Walls" over "£2k"), which is
                the one thing a scale must never do. The band below is
                sized to the tick label's own height, so the two can never
                occupy the same rows whatever the plotted positions. */}
            {plots.map((plot, index) => {
              const above = index % 2 === 0;
              const dim = hovered !== null && hovered !== index;
              return (
                <div
                  key={plot.service.slug}
                  data-scale-mark
                  className="absolute top-1/2 opacity-0"
                  style={{
                    left: `${plot.t * 100}%`,
                    transform: "translateY(18px)",
                  }}
                >
                  <Link
                    href={`/services/${plot.service.slug}`}
                    onPointerEnter={() => setHovered(index)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    className="group absolute block w-[13rem] focus-visible:outline-none"
                    style={{
                      left: 0,
                      // Marks near the right end are labelled leftwards so
                      // the text stays inside the section.
                      transform: plot.t > 0.72 ? "translateX(-100%)" : "none",
                      [above ? "bottom" : "top"]: above ? "1rem" : "3.1rem",
                    }}
                  >
                    <span
                      className="block transition-opacity duration-300"
                      style={{
                        opacity: dim ? 0.34 : 1,
                        textAlign: plot.t > 0.72 ? "right" : "left",
                      }}
                    >
                      <span
                        className="block font-title font-semibold leading-[1.1] tracking-[-0.03em] text-primary underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-300 group-hover:decoration-primary/60 group-focus-visible:decoration-primary/60"
                        style={{ fontSize: "clamp(1rem, 1.3vw, 1.25rem)" }}
                      >
                        {plot.service.title}
                      </span>
                      <span
                        className="mt-1.5 block text-[1.05rem] tabular-nums text-enzo-forest-light"
                        data-count-to={plot.price}
                        data-count-display={plot.label}
                      >
                        {plot.label}
                      </span>
                      <span className="mt-1 block text-[11.5px] text-muted-foreground">
                        {plot.timeline}
                      </span>
                    </span>
                  </Link>

                  {/* Stem down to the rule, and the mark itself. The stem
                      reaches its label, so the longer drop below the axis
                      stays visibly connected to its mark. */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 w-px bg-foreground/25 transition-colors duration-300"
                    style={{
                      height: above ? "1rem" : "3.1rem",
                      [above ? "bottom" : "top"]: 0,
                      backgroundColor: dim ? undefined : "var(--enzo-forest)",
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: dim
                        ? "color-mix(in srgb, var(--foreground) 30%, transparent)"
                        : "var(--enzo-forest)",
                      transform: hovered === index ? "scale(1.6)" : "scale(1)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Below md: the same data read downwards ── */}
        <ul className="mt-12 md:hidden">
          {plots.map((plot) => (
            <li key={plot.service.slug} className="border-t border-border/60">
              <Link
                href={`/services/${plot.service.slug}`}
                className="block py-5 focus-visible:outline-none"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-title text-[1.1rem] font-semibold tracking-[-0.025em] text-primary underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-300 group-hover:decoration-primary">
                    {plot.service.title}
                  </span>
                  <span className="shrink-0 text-[1rem] tabular-nums text-enzo-forest-light">
                    {plot.label}
                  </span>
                </span>
                {/* Bar carries the same comparison the axis does above. */}
                <span
                  aria-hidden="true"
                  className="mt-3 block h-px w-full bg-border"
                >
                  <span
                    className="block h-px bg-primary"
                    style={{ width: `${Math.max(6, plot.t * 100)}%` }}
                  />
                </span>
                <span className="mt-2 block text-[11.5px] text-muted-foreground">
                  {plot.timeline}
                </span>
              </Link>
            </li>
          ))}
          <li aria-hidden="true" className="border-t border-border/60" />
        </ul>

        <p className="mt-14 max-w-[70ch] text-[12.5px] leading-[1.7] text-muted-foreground md:mt-16">
          Starting prices are the entry specification for a typical room.
          {unpriced > 0 &&
            ` ${unpriced} service${unpriced === 1 ? " is" : "s are"} quoted on application.`}{" "}
          Your own figure comes from the survey — we do not price a room we
          have not measured.
        </p>
      </div>
    </section>
  );
}
