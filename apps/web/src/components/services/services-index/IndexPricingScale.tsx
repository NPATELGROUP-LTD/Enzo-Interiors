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
//
// ── The pin ──
// From md up the section is exactly one viewport tall and pins itself to the
// screen the moment its top reaches the top of the window, then draws the
// scale *from* the scroll rather than on a timer. So the page hands the
// screen over to this one idea, the visitor builds the comparison with their
// own wheel, and only once every mark has landed does the page move on.
//
// Two consequences worth knowing before editing:
//   · the content must fit inside 100svh at the shortest desktop height we
//     care about (~700px), because a pinned section taller than the viewport
//     hides its own bottom. Hence the clamped vertical rhythm below rather
//     than fixed padding — do not swap it back for py-28.
//   · the pin adds ~1 viewport of page height, so every trigger below it was
//     measured against a shorter document. ScrollTrigger refreshes all of
//     them when this one is created, which is why nothing downstream needs
//     to know about it.
// Touch keeps the old behaviour — the section is still a full screen tall,
// but it scrolls past normally and the scale reveals on arrival. Pinning
// costs a touch visitor the one gesture they have, and several swipes that
// visibly do nothing is a worse trade than a scale that simply appears.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
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

/**
 * How much scrolling the pinned section absorbs before it lets go — a little
 * over one screen. Short enough that nobody feels stuck, long enough that the
 * marks land one at a time rather than all at once.
 */
const PIN_SCROLL = "110%";

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
    (section, reduced, { pinned }) => {
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

      // ── The figures count themselves ──
      // The counters are deliberately NOT tweens on the scrubbed timeline.
      // A scrubbed counter is driven by the wheel, so the number is whatever
      // the scroll position says it is: park half way and a kitchen reads
      // "£9", scroll up and it counts backwards. Those intermediate values
      // are not estimates of anything — they are scroll positions wearing a
      // pound sign, on a section whose entire job is to be trusted about
      // money.
      //
      // So scroll only decides *when* each figure starts. The count itself
      // is an ordinary tween that runs to the real number at its own pace
      // and stays there, however the visitor scrolls afterwards.
      const started = new Set<number>();
      counters.forEach((el, i) => {
        const to = Number(el.dataset.countTo);
        if (!Number.isFinite(to)) return;

        const run = () => {
          if (started.has(i)) return;
          started.add(i);
          const proxy = { value: 0 };
          gsap.to(proxy, {
            value: to,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = GBP.format(Math.round(proxy.value));
            },
            // Land on the authored string, not on a re-formatted number, so
            // whatever the client typed is what finally shows.
            onComplete: () => {
              el.textContent = el.dataset.countDisplay ?? GBP.format(to);
            },
          });
        };

        // Fired as the playhead crosses the point where this mark lands, so
        // the figure still starts with its own mark. `.call` only runs
        // forwards past the marker, and `started` makes it once-only, so
        // scrubbing back and forth cannot restart a count.
        tl.call(run, undefined, 0.45 + i * 0.09);
      });

      // Leave a beat of pinned scroll after the last mark lands, so the
      // finished scale is held on screen rather than being whipped away the
      // instant it completes.
      tl.to({}, { duration: 0.5 });

      const trigger = pinned
        ? ScrollTrigger.create({
            trigger: section,
            // The section is exactly one viewport tall, so its top reaching
            // the window's top is the same moment it fills the screen.
            start: "top top",
            end: "+=" + PIN_SCROLL,
            pin: true,
            pinSpacing: true,
            // Recommended whenever a pin runs under smooth scrolling: it
            // sets the pin a hair early so the swap can't show a jump.
            anticipatePin: 1,
            scrub: 0.6,
            animation: tl,
          })
        : ScrollTrigger.create({
            trigger: section,
            start: REVEAL_START,
            once: true,
            animation: tl,
          });

      return () => {
        // `true` reverts the pin spacer with the trigger. Without it a
        // media-query swap can leave ScrollTrigger's placeholder in the DOM
        // for React to trip over on the next removal.
        trigger.kill(true);
        tl.kill();
      };
    },
    // `pointer: fine` as well as a width: a pin holds the screen for a
    // fixed distance, and on a touch device that means several swipes that
    // appear to do nothing. A portrait tablet is wide enough for the
    // horizontal scale but is still a thumb — it gets the full-height
    // section and the ordinary reveal, not the pin.
    {
      queries: { pinned: "(min-width: 768px) and (pointer: fine)" },
      deps: [plots],
    },
  );

  if (!plots.length) return null;

  return (
    <section
      ref={sectionRef}
      id="services-pricing"
      aria-labelledby="services-pricing-heading"
      // `md:min-h` not `min-h`: the pin only exists from md up, and forcing a
      // full viewport around a four-row list on a phone is just a hole.
      className="relative flex flex-col justify-center overflow-hidden bg-background md:min-h-[100svh] scroll-mt-24"
    >
      <div className="mx-auto w-full max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-[clamp(3rem,8vh,7rem)]">
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

        {/* ── md and up: horizontal scale ──
            Every gap here is clamped against viewport height rather than
            fixed, because the section has to fit inside one screen while it
            is pinned — see the note at the top of the file. */}
        <div className="mt-[clamp(2.5rem,7vh,5rem)] hidden md:block">
          <div className="relative h-[clamp(15rem,36vh,19rem)]">
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

        {/* ── Below md: the same data read downwards ──
            A trailing arrow on the name, not just on the row: the same
            "this navigates" mark the hero's mobile list and ServicesDoors'
            accordion both use, so a visitor learns it once and reads it
            everywhere on the page. */}
        <ul className="mt-12 md:hidden">
          {plots.map((plot) => (
            <li key={plot.service.slug} className="border-t border-border/60">
              <Link
                href={`/services/${plot.service.slug}`}
                className="group block py-5 focus-visible:outline-none"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="flex items-center gap-2 font-title text-[1.1rem] font-semibold tracking-[-0.025em] text-primary">
                    {plot.service.title}
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-primary/40 transition-transform duration-300 group-hover:translate-x-1"
                    />
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

        <p className="mt-14 max-w-[70ch] text-[12.5px] leading-[1.7] text-muted-foreground md:mt-[clamp(2rem,5vh,4rem)]">
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
