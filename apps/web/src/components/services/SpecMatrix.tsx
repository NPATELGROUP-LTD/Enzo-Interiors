"use client";

// /services §02 — the specification schedule.
//
// A visitor on this page is choosing between disciplines, and the old page
// gave them four near-identical marketing blocks to choose from. This is
// the thing that actually helps: one schedule, every service as a column,
// the figures that differ as rows — lead time, where the pricing starts,
// how many finishes there are, how much is included as standard.
//
// None of these figures are authored. They are derived from the records the
// client already fills in (see src/lib/service-metrics.ts), so publishing a
// fifth service in the Admin app adds a fifth column with correct numbers
// and nothing else to do.
//
// It is a real <table> — a comparison schedule is exactly what tables are
// for, and it means a screen-reader user gets the row/column relationships
// for free. The bars are decoration on top of readable values, never a
// replacement for them.
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { getServiceMetrics } from "@/lib/service-metrics";
import { cn } from "@/lib/utils";
import type { ServiceDetail } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

interface Cell {
  /** What the visitor reads. Always present, bar or no bar. */
  display: string;
  /** Set when the value should count up on reveal. */
  count?: { to: number; kind: "plain" | "currency" };
  /** 0–1 share of the largest value in the row; omitted means no bar. */
  ratio?: number;
}

interface MatrixRow {
  key: string;
  label: string;
  note?: string;
  cells: Cell[];
}

interface SpecMatrixProps {
  services: ServiceDetail[];
}

export function SpecMatrix({ services }: SpecMatrixProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [column, setColumn] = useState<number | null>(null);

  const rows = useMemo<MatrixRow[]>(() => {
    const metrics = services.map(getServiceMetrics);
    // `|| 1` keeps the bar maths total when a column is missing a figure —
    // a half-authored draft service shouldn't divide by zero.
    const share = (value: number | null, max: number) =>
      value === null || max <= 0 ? undefined : value / max;

    const maxLead = Math.max(0, ...metrics.map((m) => m.leadWeeks ?? 0));
    const maxPrice = Math.max(0, ...metrics.map((m) => m.fromPriceValue ?? 0));
    const maxFinishes = Math.max(0, ...metrics.map((m) => m.finishes));
    const maxIncluded = Math.max(0, ...metrics.map((m) => m.included));
    const maxStages = Math.max(0, ...metrics.map((m) => m.stages));
    const maxTiers = Math.max(0, ...metrics.map((m) => m.tiers));

    return [
      {
        key: "lead",
        label: "Lead time",
        note: "design sign-off to fitted",
        cells: metrics.map((m) => ({
          display: m.timeline,
          ratio: share(m.leadWeeks, maxLead),
        })),
      },
      {
        key: "from",
        label: "Starting price",
        note: "entry specification",
        cells: metrics.map((m) => ({
          display: m.fromPriceLabel ?? "On application",
          count:
            m.fromPriceValue !== null
              ? ({ to: m.fromPriceValue, kind: "currency" } as const)
              : undefined,
          ratio: share(m.fromPriceValue, maxPrice),
        })),
      },
      {
        key: "finishes",
        label: "Finishes offered",
        cells: metrics.map((m) => ({
          display: String(m.finishes),
          count: { to: m.finishes, kind: "plain" } as const,
          ratio: share(m.finishes, maxFinishes),
        })),
      },
      {
        key: "included",
        label: "Included as standard",
        note: "no-cost line items",
        cells: metrics.map((m) => ({
          display: String(m.included),
          count: { to: m.included, kind: "plain" } as const,
          ratio: share(m.included, maxIncluded),
        })),
      },
      {
        key: "stages",
        label: "Build stages",
        cells: metrics.map((m) => ({
          display: String(m.stages),
          count: { to: m.stages, kind: "plain" } as const,
          ratio: share(m.stages, maxStages),
        })),
      },
      {
        key: "tiers",
        label: "Specification tiers",
        cells: metrics.map((m) => ({
          display: String(m.tiers),
          count: { to: m.tiers, kind: "plain" } as const,
          ratio: share(m.tiers, maxTiers),
        })),
      },
    ];
  }, [services]);

  useGSAP(
    sectionRef,
    (section, reduced) => {
      const heads = gsap.utils.toArray<HTMLElement>("[data-matrix-head]", section);
      const cells = gsap.utils.toArray<HTMLElement>("[data-matrix-cell]", section);
      const bars = gsap.utils.toArray<HTMLElement>("[data-matrix-bar]", section);
      const counters = gsap.utils.toArray<HTMLElement>("[data-count-to]", section);

      if (reduced) {
        gsap.set([...heads, ...cells], { opacity: 1, y: 0 });
        gsap.set(bars, { scaleX: 1 });
        counters.forEach((el) => {
          el.textContent = el.dataset.countDisplay ?? el.textContent;
        });
        return;
      }

      const tl = gsap.timeline({ paused: true });

      tl.to(heads, { opacity: 1, y: 0, duration: 0.7, ease: EASE.enter, stagger: 0.07 })
        // Cells are queried in DOM order, which for a table is row-major —
        // exactly what GSAP's grid stagger wants, so the reveal runs as a
        // diagonal wave across the schedule rather than row by row.
        .to(
          cells,
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: EASE.enter,
            stagger: { grid: [rows.length, services.length], from: "start", each: 0.035 },
          },
          0.16,
        )
        .to(
          bars,
          { scaleX: 1, duration: 0.9, ease: EASE.editorial, stagger: 0.03 },
          0.3,
        );

      // Numbers count rather than appear. Tweening a proxy and writing
      // textContent keeps the DOM node React rendered as the single source
      // of the final string — React never re-renders it mid-tween because
      // nothing in state changes.
      counters.forEach((el, i) => {
        const to = Number(el.dataset.countTo);
        const kind = el.dataset.countKind;
        if (!Number.isFinite(to)) return;
        const proxy = { value: 0 };
        tl.to(
          proxy,
          {
            value: to,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent =
                kind === "currency"
                  ? GBP.format(Math.round(proxy.value))
                  : String(Math.round(proxy.value));
            },
          },
          0.3 + i * 0.02,
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
    { deps: [rows] },
  );

  const columnState = (index: number) =>
    column === null ? "idle" : column === index ? "on" : "off";

  return (
    <section
      ref={sectionRef}
      aria-labelledby="services-matrix-heading"
      className="relative bg-background"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="services-matrix-heading" className="sr-only">
          Compare services
        </h2>

        <SectionIntro
          layout="split"
          index="02"
          label="Schedule"
          datum={`${services.length} columns`}
          lines={["Everything, on", "one schedule."]}
          lede="The figures that actually differ between disciplines, pulled straight from each one's specification — not a marketing summary of it."
        />

        {/* Horizontal scroll is the honest answer for a schedule with more
            columns than a phone is wide. The label column stays put so a
            scrolled-away figure never loses its row. */}
        <div className="mt-10 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">
              Lead time, starting price and specification counts for each
              service
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-[13rem] bg-background pb-5 pr-6 align-bottom"
                >
                  <span
                    data-matrix-head
                    className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-forest-light opacity-0"
                    style={{ transform: "translateY(10px)" }}
                  >
                    Specification
                  </span>
                </th>
                {services.map((service, index) => (
                  <th
                    key={service.slug}
                    scope="col"
                    onPointerEnter={() => setColumn(index)}
                    onPointerLeave={() => setColumn(null)}
                    className="min-w-[10.5rem] px-4 pb-5 align-bottom"
                  >
                    <span
                      data-matrix-head
                      className="block opacity-0"
                      style={{ transform: "translateY(10px)" }}
                    >
                      <Link
                        href={`/services/${service.slug}`}
                        onFocus={() => setColumn(index)}
                        onBlur={() => setColumn(null)}
                        className="group block focus-visible:outline-none"
                      >
                        <span className="font-display block text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest-light/70">
                          {String(index + 1).padStart(2, "0")} / {service.category}
                        </span>
                        <span
                          className={cn(
                            "mt-1.5 block font-title text-[1.05rem] font-semibold leading-[1.15] tracking-[-0.025em] transition-colors duration-300",
                            columnState(index) === "off"
                              ? "text-primary/40"
                              : "text-primary",
                          )}
                        >
                          {service.title}
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-[11.5px] text-enzo-forest-light opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                          View
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="group/row border-t border-border/60">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background py-5 pr-6 align-top font-normal"
                  >
                    <span
                      data-matrix-cell
                      className="block opacity-0"
                      style={{ transform: "translateY(10px)" }}
                    >
                      <span className="block text-[13.5px] font-medium tracking-[-0.01em] text-primary transition-colors duration-300 group-hover/row:text-enzo-forest-light">
                        {row.label}
                      </span>
                      {row.note && (
                        <span className="mt-1 block text-[11.5px] text-muted-foreground">
                          {row.note}
                        </span>
                      )}
                    </span>
                  </th>

                  {row.cells.map((cell, index) => {
                    const state = columnState(index);
                    return (
                      <td
                        key={`${row.key}-${services[index].slug}`}
                        onPointerEnter={() => setColumn(index)}
                        onPointerLeave={() => setColumn(null)}
                        className={cn(
                          "px-4 py-5 align-top transition-colors duration-300",
                          state === "on" && "bg-card",
                        )}
                      >
                        <span
                          data-matrix-cell
                          className="block opacity-0"
                          style={{ transform: "translateY(10px)" }}
                        >
                          <span
                            className={cn(
                              "block text-[15px] tabular-nums tracking-[-0.01em] transition-colors duration-300",
                              state === "off"
                                ? "text-foreground/40"
                                : "text-foreground",
                            )}
                          >
                            {cell.count ? (
                              <span
                                data-count-to={cell.count.to}
                                data-count-kind={cell.count.kind}
                                data-count-display={cell.display}
                              >
                                {cell.display}
                              </span>
                            ) : (
                              cell.display
                            )}
                          </span>

                          {cell.ratio !== undefined && (
                            <span
                              aria-hidden="true"
                              className="mt-2.5 block h-px w-full bg-border/70"
                            >
                              <span
                                data-matrix-bar
                                className={cn(
                                  "block h-px origin-left transition-colors duration-300",
                                  state === "off" ? "bg-primary/30" : "bg-primary",
                                )}
                                style={{
                                  width: `${Math.max(6, cell.ratio * 100)}%`,
                                  transform: "scaleX(0)",
                                }}
                              />
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[12px] text-muted-foreground">
          Starting prices are the entry specification for a typical room. Your
          own figure comes from the survey — we measure before we quote.
        </p>
      </div>
    </section>
  );
}
